using PrimeHomes.API.Models;

namespace PrimeHomes.API.Services
{
    /// <summary>Search filters shared by the results page and saved-search alerts, so both match listings identically.</summary>
    public static class PropertySearch
    {
        public static IQueryable<Property> Apply(IQueryable<Property> q, PropertySearchQuery query)
        {
            if (!string.IsNullOrWhiteSpace(query.Q))
            {
                var text = query.Q.Trim();
                q = q.Where(p => p.Title.Contains(text) || p.Location.Contains(text) || p.City.Contains(text));
            }

            if (!string.IsNullOrWhiteSpace(query.City))
                q = q.Where(p => p.City == query.City.Trim());

            var localities = SplitList(query.Localities);
            if (localities.Count > 0)
                q = q.Where(p => localities.Contains(p.Location));

            if (!string.IsNullOrWhiteSpace(query.ListingType))
                q = q.Where(p => p.ListingType == query.ListingType);

            var types = SplitList(query.PropertyTypes);
            if (types.Count > 0)
                q = q.Where(p => types.Contains(p.PropertyType));

            var bhks = SplitList(query.Bhk).Select(b => int.TryParse(b, out var n) ? n : -1).Where(n => n >= 0).ToList();
            if (bhks.Count > 0)
            {
                // "5" means 5 or more, matching the "5+ BHK" filter chip.
                var fivePlus = bhks.Contains(5);
                q = q.Where(p => bhks.Contains(p.BHK) || (fivePlus && p.BHK >= 5));
            }

            if (query.MinPrice is { } minPrice) q = q.Where(p => p.Price >= minPrice);
            if (query.MaxPrice is { } maxPrice) q = q.Where(p => p.Price <= maxPrice);
            if (query.MinArea is { } minArea) q = q.Where(p => p.Area >= minArea);
            if (query.MaxArea is { } maxArea) q = q.Where(p => p.Area <= maxArea);

            var furnishing = SplitList(query.Furnishing);
            if (furnishing.Count > 0)
                q = q.Where(p => p.Furnishing != null && furnishing.Contains(p.Furnishing));

            if (!string.IsNullOrWhiteSpace(query.ConstructionStatus))
                q = q.Where(p => p.ConstructionStatus == query.ConstructionStatus);

            if (query.VerifiedOnly == true)
                q = q.Where(p => p.IsVerified);

            // Amenities are stored as a JSON array of strings; match each quoted value.
            foreach (var amenity in SplitList(query.Amenities))
            {
                var token = $"\"{amenity}\"";
                q = q.Where(p => p.LifestyleFeatures.Contains(token));
            }

            return q;
        }

        public static List<string> SplitList(string? csv) =>
            string.IsNullOrWhiteSpace(csv)
                ? []
                : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct().ToList();
    }
}
