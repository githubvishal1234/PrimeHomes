using System.Text.RegularExpressions;

namespace PrimeHomes.API.Services
{
    /// <summary>Readable URL part, e.g. "spacious-3-bhk-with-lake-view-in-kondapur-hyderabad". Must match the UI's slugFor().</summary>
    public static partial class Slug
    {
        public static string For(string title, string city)
        {
            var text = title.Contains(city, StringComparison.OrdinalIgnoreCase) ? title : $"{title} {city}";
            var slug = NonAlphanumeric().Replace(text.ToLowerInvariant(), "-").Trim('-');
            return slug.Length > 80 ? slug[..80].TrimEnd('-') : slug;
        }

        [GeneratedRegex("[^a-z0-9]+")]
        private static partial Regex NonAlphanumeric();
    }
}
