namespace PrimeHomes.API.Models
{
    public class Property
    {
        public int PropertyId { get; set; }

        public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        public string PropertyType { get; set; } = string.Empty;

        /// <summary>Sale or Rent.</summary>
        public string ListingType { get; set; } = "Sale";

        public int BHK { get; set; }

        public int? Bathrooms { get; set; }

        /// <summary>Sale price, or monthly rent when ListingType is Rent.</summary>
        public decimal Price { get; set; }

        /// <summary>Built-up area in sq ft.</summary>
        public decimal Area { get; set; }

        /// <summary>Unfurnished, Semi-furnished or Furnished.</summary>
        public string? Furnishing { get; set; }

        public int? Floor { get; set; }

        public int? TotalFloors { get; set; }

        public string? Facing { get; set; }

        /// <summary>Ready to move or Under construction.</summary>
        public string? ConstructionStatus { get; set; }

        public int? AgeYears { get; set; }

        public int? Parking { get; set; }

        public string Location { get; set; } = string.Empty;

        public string City { get; set; } = string.Empty;

        // Property map coordinates
        public double? Latitude { get; set; }

        public double? Longitude { get; set; }

        public string? ImageUrl { get; set; }

        public int OwnerId { get; set; }

        /// <summary>See <see cref="PropertyStatus"/>.</summary>
        public string Status { get; set; } = PropertyStatus.Pending;

        public string? RejectReason { get; set; }

        public string? Badge { get; set; }

        public bool IsVerified { get; set; }

        public int ViewCount { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedDate { get; set; }

        public DateTime? ApprovedDate { get; set; }

        /// <summary>Price buyers last saw live; a lower price at the next approval is a price drop.</summary>
        public decimal? ApprovedPrice { get; set; }

        // Multiple images for this property
        public ICollection<PropertyImage> Images { get; set; }
            = new List<PropertyImage>();

        // Selected lifestyle and community features stored as JSON
        public string LifestyleFeatures { get; set; } = "[]";
    }
}
