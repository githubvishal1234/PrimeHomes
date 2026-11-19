using PrimeHomes.API.Models;

namespace PrimeHomes.API.Services
{
    /// <summary>Heuristics an admin reviews by eye: flags, never blocks.</summary>
    public static class DuplicateCheck
    {
        /// <summary>Why <paramref name="candidate"/> looks like a copy of <paramref name="other"/>, or null.</summary>
        public static string? Reason(Property candidate, Property other)
        {
            // Same photo on two listings: the classic copied-listing signal.
            if (!string.IsNullOrWhiteSpace(candidate.ImageUrl)
                && string.Equals(candidate.ImageUrl, other.ImageUrl, StringComparison.OrdinalIgnoreCase))
                return "Same main photo";

            var samePlace = string.Equals(candidate.City.Trim(), other.City.Trim(), StringComparison.OrdinalIgnoreCase)
                && string.Equals(candidate.Location.Trim(), other.Location.Trim(), StringComparison.OrdinalIgnoreCase);

            if (samePlace
                && candidate.ListingType == other.ListingType
                && candidate.BHK == other.BHK
                && Close(candidate.Price, other.Price)
                && Close(candidate.Area, other.Area))
            {
                return candidate.OwnerId == other.OwnerId
                    ? "Same owner, same locality, size and price (reposted?)"
                    : "Another owner lists the same locality, size and price";
            }

            return null;
        }

        private static bool Close(decimal a, decimal b) =>
            a > 0 && b > 0 && Math.Abs(a - b) / Math.Max(a, b) <= 0.05m;
    }
}
