using System.ComponentModel.DataAnnotations;

namespace PrimeHomes.API.Models
{
    /// <summary>A buyer's saved filters. New matching listings trigger an alert when they go live.</summary>
    public class SavedSearch
    {
        public int SavedSearchId { get; set; }

        public int UserId { get; set; }

        [MaxLength(120)]
        public string Name { get; set; } = string.Empty;

        /// <summary>The search page's query string (e.g. "city=Hyderabad&amp;bhk=2,3&amp;maxPrice=8000000").</summary>
        [MaxLength(1000)]
        public string Query { get; set; } = string.Empty;

        public bool AlertsEnabled { get; set; } = true;

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        public DateTime? LastAlertDate { get; set; }
    }

    /// <summary>Views per listing per day (UTC), for owner analytics.</summary>
    public class PropertyViewDaily
    {
        public int PropertyId { get; set; }

        public DateTime Day { get; set; }

        public int Views { get; set; }
    }
}
