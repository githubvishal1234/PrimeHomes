using System.ComponentModel.DataAnnotations;

namespace PrimeHomes.API.Models
{
    /// <summary>Fields an owner may set when creating or editing a listing. Status, owner, badge and counters are server-controlled.</summary>
    public class PropertyRequest
    {
        [Required, StringLength(200, MinimumLength = 5)]
        public string Title { get; set; } = string.Empty;

        [StringLength(5000)]
        public string Description { get; set; } = string.Empty;

        [RegularExpression("^(Apartment|Villa|House|Plot|Commercial)$", ErrorMessage = "Choose a valid property type.")]
        public string PropertyType { get; set; } = string.Empty;

        [RegularExpression("^(Sale|Rent)$", ErrorMessage = "Listing type must be Sale or Rent.")]
        public string ListingType { get; set; } = "Sale";

        [Range(0, 20)]
        public int BHK { get; set; }

        [Range(0, 20)]
        public int? Bathrooms { get; set; }

        [Range(0, 10_000_000_000, ErrorMessage = "Enter a valid price.")]
        public decimal Price { get; set; }

        [Range(0, 10_000_000, ErrorMessage = "Enter a valid area in sq ft.")]
        public decimal Area { get; set; }

        [RegularExpression("^(Unfurnished|Semi-furnished|Furnished)$", ErrorMessage = "Choose a valid furnishing option.")]
        public string? Furnishing { get; set; }

        [Range(-3, 200)]
        public int? Floor { get; set; }

        [Range(0, 200)]
        public int? TotalFloors { get; set; }

        [RegularExpression("^(North|South|East|West|North-East|North-West|South-East|South-West)$", ErrorMessage = "Choose a valid facing.")]
        public string? Facing { get; set; }

        [RegularExpression("^(Ready to move|Under construction)$", ErrorMessage = "Choose a valid construction status.")]
        public string? ConstructionStatus { get; set; }

        [Range(0, 200)]
        public int? AgeYears { get; set; }

        [Range(0, 50)]
        public int? Parking { get; set; }

        [StringLength(200)]
        public string Location { get; set; } = string.Empty;

        [StringLength(100)]
        public string City { get; set; } = string.Empty;

        [Range(-90, 90)]
        public double? Latitude { get; set; }

        [Range(-180, 180)]
        public double? Longitude { get; set; }

        [StringLength(500)]
        public string? ImageUrl { get; set; }

        [StringLength(4000)]
        public string? LifestyleFeatures { get; set; }

        /// <summary>When true on create, the listing is saved as a Draft instead of being sent for review.</summary>
        public bool SaveAsDraft { get; set; }

        /// <summary>
        /// Drafts may be incomplete; anything going to review must have these.
        /// Returns field → message for what is missing (empty when ready).
        /// </summary>
        public static Dictionary<string, string[]> MissingForReview(Property p)
        {
            var missing = new Dictionary<string, string[]>();
            if (string.IsNullOrWhiteSpace(p.PropertyType)) missing["PropertyType"] = ["Choose a property type."];
            if (p.Price <= 0) missing["Price"] = ["Enter the price."];
            if (p.Area <= 0) missing["Area"] = ["Enter the built-up area."];
            if (string.IsNullOrWhiteSpace(p.Location)) missing["Location"] = ["Enter the locality."];
            if (string.IsNullOrWhiteSpace(p.City)) missing["City"] = ["Enter the city."];
            return missing;
        }

        public void ApplyTo(Property p)
        {
            p.Title = Title.Trim();
            p.Description = Description?.Trim() ?? string.Empty;
            p.PropertyType = PropertyType;
            p.ListingType = ListingType;
            p.BHK = BHK;
            p.Bathrooms = Bathrooms;
            p.Price = Price;
            p.Area = Area;
            p.Furnishing = Furnishing;
            p.Floor = Floor;
            p.TotalFloors = TotalFloors;
            p.Facing = Facing;
            p.ConstructionStatus = ConstructionStatus;
            p.AgeYears = AgeYears;
            p.Parking = Parking;
            p.Location = Location?.Trim() ?? string.Empty;
            p.City = City?.Trim() ?? string.Empty;
            p.PropertyType = PropertyType ?? string.Empty;
            p.Latitude = Latitude;
            p.Longitude = Longitude;
            p.ImageUrl = string.IsNullOrWhiteSpace(ImageUrl) ? null : ImageUrl.Trim();
            p.LifestyleFeatures = string.IsNullOrWhiteSpace(LifestyleFeatures) ? "[]" : LifestyleFeatures;
        }
    }

    public class RejectPropertyRequest
    {
        [Required, StringLength(500, MinimumLength = 5, ErrorMessage = "Give the owner a reason (at least 5 characters).")]
        public string Reason { get; set; } = string.Empty;
    }

    public class ClosePropertyRequest
    {
        [Required, RegularExpression("^(Sold|Rented)$")]
        public string Status { get; set; } = string.Empty;
    }

    public class VerifyPropertyRequest
    {
        public bool IsVerified { get; set; }
    }

    /// <summary>Query string for GET /api/Properties/search. Every filter is optional.</summary>
    public class PropertySearchQuery
    {
        /// <summary>Free text matched against title, locality and city.</summary>
        [StringLength(100)]
        public string? Q { get; set; }

        [StringLength(100)]
        public string? City { get; set; }

        /// <summary>Comma-separated localities (exact match), e.g. "Kondapur,Gachibowli".</summary>
        [StringLength(500)]
        public string? Localities { get; set; }

        public string? ListingType { get; set; }

        /// <summary>Comma-separated, e.g. "Apartment,Villa".</summary>
        public string? PropertyTypes { get; set; }

        /// <summary>Comma-separated, e.g. "2,3". 5 means 5 or more.</summary>
        public string? Bhk { get; set; }

        public decimal? MinPrice { get; set; }
        public decimal? MaxPrice { get; set; }
        public decimal? MinArea { get; set; }
        public decimal? MaxArea { get; set; }

        /// <summary>Comma-separated furnishing values.</summary>
        public string? Furnishing { get; set; }

        public string? ConstructionStatus { get; set; }

        public bool? VerifiedOnly { get; set; }

        /// <summary>Comma-separated amenities; a listing must have all of them.</summary>
        public string? Amenities { get; set; }

        /// <summary>relevance (default), newest, price_asc, price_desc, price_per_sqft, area_desc.</summary>
        public string? Sort { get; set; }

        [Range(1, 10_000)]
        public int Page { get; set; } = 1;

        [Range(1, 50)]
        public int PageSize { get; set; } = 12;
    }

    public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize)
    {
        public int TotalPages => (int)Math.Ceiling(Total / (double)PageSize);
    }

    /// <summary>Card-sized view of a live listing.</summary>
    public record PropertySummary(
        int PropertyId,
        string Title,
        string PropertyType,
        string ListingType,
        int BHK,
        int? Bathrooms,
        decimal Price,
        decimal Area,
        decimal PricePerSqft,
        string? Furnishing,
        string? ConstructionStatus,
        string Location,
        string City,
        double? Latitude,
        double? Longitude,
        string? ImageUrl,
        int ImageCount,
        string? Badge,
        bool IsVerified,
        string LifestyleFeatures,
        DateTime CreatedDate,
        int? Floor,
        int? TotalFloors,
        int? AgeYears,
        string Snippet,
        DateTime? ApprovedDate);
}
