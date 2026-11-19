import { slugFor } from '../models/property';

describe('slugFor (must match the API sitemap)', () => {
  it('adds the city once', () => {
    expect(slugFor('Spacious 3 BHK with lake view in Kondapur', 'Hyderabad')).toBe('spacious-3-bhk-with-lake-view-in-kondapur-hyderabad');
    expect(slugFor('Sea-facing 3 BHK on Beach Road, Visakhapatnam', 'Visakhapatnam')).toBe('sea-facing-3-bhk-on-beach-road-visakhapatnam');
  });
});
