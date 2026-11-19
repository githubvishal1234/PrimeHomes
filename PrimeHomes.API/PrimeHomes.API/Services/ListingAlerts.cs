using System.Globalization;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using PrimeHomes.API.Data;
using PrimeHomes.API.Models;

namespace PrimeHomes.API.Services
{
    /// <summary>Tells buyers when a listing goes live that matches a saved search, or when a shortlisted home gets cheaper.</summary>
    public class ListingAlerts
    {
        private readonly PrimeHomesDbContext _db;
        private readonly Notifier _notifier;

        public ListingAlerts(PrimeHomesDbContext db, Notifier notifier)
        {
            _db = db;
            _notifier = notifier;
        }

        /// <summary>Call right after a listing is approved. Each buyer gets at most one alert per listing.</summary>
        // ponytail: one query per saved search per approval; batch or move to a queue past a few thousand saved searches.
        public async Task OnApprovedAsync(Property property, decimal? previousApprovedPrice)
        {
            var searches = await _db.SavedSearches
                .Where(s => s.AlertsEnabled && s.UserId != property.OwnerId)
                .ToListAsync();

            var alerted = new HashSet<int>();

            foreach (var search in searches.Where(s => !alerted.Contains(s.UserId)))
            {
                var query = ParseQuery(search.Query);
                var matches = await PropertySearch
                    .Apply(_db.Properties.Where(p => p.PropertyId == property.PropertyId && p.Status == PropertyStatus.Approved), query)
                    .AnyAsync();

                if (!matches) continue;

                alerted.Add(search.UserId);
                search.LastAlertDate = DateTime.UtcNow;

                await _notifier.NotifyAsync(search.UserId, $"New match for \"{search.Name}\"",
                    $"'{property.Title}' in {property.Location}, {property.City} just went live and matches your saved search.",
                    "SavedSearchMatch", property.PropertyId, email: true);
            }

            if (previousApprovedPrice is { } before && property.Price < before)
            {
                var shortlisters = await _db.Favorites
                    .Where(f => f.PropertyId == property.PropertyId)
                    .Select(f => f.BuyerId)
                    .Distinct()
                    .ToListAsync();

                foreach (var buyerId in shortlisters)
                {
                    await _notifier.NotifyAsync(buyerId, "Price drop on a shortlisted home",
                        $"'{property.Title}' is now ₹{property.Price:N0} (was ₹{before:N0}).",
                        "PriceDrop", property.PropertyId, email: true);
                }
            }

            await _db.SaveChangesAsync();
        }

        /// <summary>Reads the search page's query string, using the same parameter names as the UI URL.</summary>
        public static PropertySearchQuery ParseQuery(string queryString)
        {
            var q = QueryHelpers.ParseQuery(queryString.StartsWith('?') ? queryString : "?" + queryString);
            string? Get(string key) => q.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v.ToString() : null;
            decimal? Num(string key) => decimal.TryParse(Get(key), NumberStyles.Number, CultureInfo.InvariantCulture, out var n) ? n : null;

            return new PropertySearchQuery
            {
                Q = Get("q"),
                City = Get("city"),
                ListingType = Get("type") == "rent" ? "Rent" : "Sale",
                PropertyTypes = Get("propertyTypes"),
                Bhk = Get("bhk"),
                Furnishing = Get("furnishing"),
                Amenities = Get("amenities"),
                ConstructionStatus = Get("status"),
                VerifiedOnly = Get("verified") == "1" ? true : null,
                MinPrice = Num("minPrice"),
                MaxPrice = Num("maxPrice"),
                MinArea = Num("minArea"),
                MaxArea = Num("maxArea")
            };
        }
    }
}
