using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PrimeHomes.API.Models;

namespace PrimeHomes.API.Data
{
    /// <summary>
    /// Development only: applies migrations, seeds test users into an empty Users table and
    /// demo listings into an empty Properties table. Never runs in production.
    /// </summary>
    public static class DevSeeder
    {
        private static readonly (string Name, string Email, string? Phone, string Password, string Role)[] TestUsers =
        [
            ("Prime Admin", "admin@primehomes.com", "9000000001", "Admin@123", "Admin"),
            ("Ravi Kumar", "ravi@primehomes.com", "9000000002", "Ravi@123", "Owner"),
            ("Venkat", "venkat@primehomes.com", "9000000003", "Venkat@123", "Buyer"),
            ("Suresh Kumar", "suresh@primehomes.com", "9876543210", "Suresh@123", "Owner"),
            ("shareef", "shareef@gmail.com", null, "shareef@123", "Buyer"),
            ("Anusha", "anusha@primehomes.com", null, "anusha@123", "Owner"),
        ];

        private record Demo(
            string Owner, string Title, string Type, string Listing, int Bhk, int Baths, decimal Price, decimal Area,
            string Furnishing, int Floor, int Floors, string Facing, string Construction, int Age, int Parking,
            string Location, string City, double Lat, double Lng, string Image, string[] Amenities,
            string Status = PropertyStatus.Approved, string? Badge = null, bool Verified = false, string? RejectReason = null);

        private static readonly Demo[] DemoListings =
        [
            new("ravi@primehomes.com", "Spacious 3 BHK with lake view in Kondapur", "Apartment", "Sale", 3, 3, 12_500_000, 1850,
                "Semi-furnished", 9, 18, "East", "Ready to move", 3, 2, "Kondapur", "Hyderabad", 17.4700, 78.3570,
                "ph-kondapur-3bhk.webp", ["Swimming Pool", "Fitness Centre", "Clubhouse", "Security", "Parking"], Badge: "FEATURED", Verified: true),
            new("ravi@primehomes.com", "Modern 2 BHK near Hitech City metro", "Apartment", "Rent", 2, 2, 32_000, 1150,
                "Furnished", 5, 12, "North-East", "Ready to move", 2, 1, "Madhapur", "Hyderabad", 17.4483, 78.3915,
                "ph-madhapur-2bhk.webp", ["Fitness Centre", "Security", "Parking", "Power Backup"], Verified: true),
            new("ravi@primehomes.com", "Luxury 4 BHK villa in gated community", "Villa", "Sale", 4, 5, 38_500_000, 4200,
                "Furnished", 0, 2, "North", "Ready to move", 1, 3, "Gachibowli", "Hyderabad", 17.4401, 78.3489,
                "ph-gachibowli-villa.webp", ["Swimming Pool", "Clubhouse", "Security", "Parking", "Garden"], Badge: "PREMIUM", Verified: true),
            new("suresh@primehomes.com", "Independent 3 BHK house with garden", "House", "Sale", 3, 3, 9_800_000, 2100,
                "Unfurnished", 0, 2, "East", "Ready to move", 6, 2, "Benz Circle", "Vijayawada", 16.4996, 80.6560,
                "ph-benz-circle-house.webp", ["Garden", "Parking", "Security"]),
            new("suresh@primehomes.com", "Sea-facing 3 BHK on Beach Road", "Apartment", "Sale", 3, 3, 14_200_000, 1720,
                "Semi-furnished", 11, 15, "South-East", "Ready to move", 4, 1, "Beach Road", "Visakhapatnam", 17.7215, 83.3350,
                "ph-beach-road-3bhk.webp", ["Swimming Pool", "Fitness Centre", "Security", "Parking"], Badge: "HOT PROPERTY", Verified: true),
            new("suresh@primehomes.com", "Affordable 2 BHK for families", "Apartment", "Rent", 2, 2, 14_500, 1050,
                "Semi-furnished", 2, 5, "West", "Ready to move", 8, 1, "MVP Colony", "Visakhapatnam", 17.7400, 83.3360,
                "ph-mvp-colony-2bhk.webp", ["Security", "Parking", "Children's Play Area"]),
            new("suresh@primehomes.com", "Under-construction 3 BHK in Amaravati", "Apartment", "Sale", 3, 2, 7_200_000, 1480,
                "Unfurnished", 6, 14, "North-East", "Under construction", 0, 1, "Tullur", "Amaravati", 16.5062, 80.5150,
                "ph-amaravati-3bhk.webp", ["Clubhouse", "Swimming Pool", "Parking"], Badge: "NEW"),
            new("anusha@primehomes.com", "Cosy 1 BHK near Whitefield IT park", "Apartment", "Rent", 1, 1, 18_000, 650,
                "Furnished", 3, 8, "North", "Ready to move", 5, 1, "Whitefield", "Bengaluru", 12.9698, 77.7500,
                "ph-whitefield-1bhk.webp", ["Fitness Centre", "Security", "Power Backup"], Verified: true),
            new("anusha@primehomes.com", "Heritage stone cottage with large plot", "House", "Sale", 2, 2, 8_900_000, 1600,
                "Semi-furnished", 0, 1, "South", "Ready to move", 25, 2, "Jubilee Hills", "Hyderabad", 17.4326, 78.4071,
                "ph-jubilee-cottage.webp", ["Garden", "Parking"]),
            new("anusha@primehomes.com", "Premium 4 BHK villa with private pool", "Villa", "Sale", 4, 4, 52_000_000, 5200,
                "Furnished", 0, 3, "East", "Ready to move", 2, 4, "Sarjapur Road", "Bengaluru", 12.9100, 77.6870,
                "ph-sarjapur-villa.webp", ["Swimming Pool", "Garden", "Security", "Parking", "Clubhouse"], Badge: "PREMIUM", Verified: true),

            // Other lifecycle states so owner and admin screens have something to show.
            new("anusha@primehomes.com", "2 BHK duplex near Kukatpally metro", "House", "Sale", 2, 2, 6_400_000, 1250,
                "Unfurnished", 0, 2, "West", "Ready to move", 10, 1, "Kukatpally", "Hyderabad", 17.4948, 78.3996,
                "ph-kukatpally-duplex.webp", ["Parking"],
                Status: PropertyStatus.Pending),
            new("ravi@primehomes.com", "Furnished studio near Ameerpet metro", "Apartment", "Rent", 1, 1, 9_000, 420,
                "Furnished", 1, 4, "North", "Ready to move", 12, 0, "Ameerpet", "Hyderabad", 17.4375, 78.4483,
                "ph-ameerpet-studio.webp", ["Security"],
                Status: PropertyStatus.Rejected, RejectReason: "Please add clear photos of the kitchen and bathroom."),
            new("suresh@primehomes.com", "Residential plot in Brodipet", "Plot", "Sale", 0, 0, 3_500_000, 2400,
                "Unfurnished", 0, 0, "East", "Ready to move", 0, 0, "Brodipet", "Guntur", 16.3067, 80.4365,
                "ph-brodipet-plot.webp", [],
                Status: PropertyStatus.Draft),
        ];

        public static async Task RunAsync(IServiceProvider services)
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PrimeHomesDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();

            await db.Database.MigrateAsync();

            if (!await db.Users.AnyAsync())
            {
                foreach (var u in TestUsers)
                {
                    var user = new User { Name = u.Name, Email = u.Email, Phone = u.Phone, Role = u.Role, EmailVerified = true };
                    user.Password = hasher.HashPassword(user, u.Password);
                    db.Users.Add(user);
                }
                await db.SaveChangesAsync();
            }

            if (!await db.Properties.AnyAsync())
            {
                var owners = await db.Users.Where(u => u.Role == "Owner").ToDictionaryAsync(u => u.Email, u => u.UserId);
                var now = DateTime.UtcNow;
                var age = 0;

                foreach (var d in DemoListings.Where(d => owners.ContainsKey(d.Owner)))
                {
                    var created = now.AddDays(-(++age * 3));
                    db.Properties.Add(new Property
                    {
                        OwnerId = owners[d.Owner],
                        Title = d.Title,
                        Description = $"{d.Title}. {d.Bhk} BHK {d.Type.ToLowerInvariant()} in {d.Location}, {d.City}: {d.Area:N0} sq ft, {d.Furnishing.ToLowerInvariant()}, {d.Facing.ToLowerInvariant()}-facing. Close to schools, hospitals and daily needs.",
                        PropertyType = d.Type,
                        ListingType = d.Listing,
                        BHK = d.Bhk,
                        Bathrooms = d.Baths,
                        Price = d.Price,
                        Area = d.Area,
                        Furnishing = d.Furnishing,
                        Floor = d.Floor,
                        TotalFloors = d.Floors,
                        Facing = d.Facing,
                        ConstructionStatus = d.Construction,
                        AgeYears = d.Age,
                        Parking = d.Parking,
                        Location = d.Location,
                        City = d.City,
                        Latitude = d.Lat,
                        Longitude = d.Lng,
                        ImageUrl = $"/uploads/{d.Image}",
                        LifestyleFeatures = System.Text.Json.JsonSerializer.Serialize(d.Amenities),
                        Status = d.Status,
                        RejectReason = d.RejectReason,
                        Badge = d.Badge,
                        IsVerified = d.Verified,
                        CreatedDate = created,
                        ApprovedDate = d.Status == PropertyStatus.Approved ? created.AddHours(4) : null,
                        UpdatedDate = d.Status == PropertyStatus.Approved ? now : null
                    });
                }

                await db.SaveChangesAsync();
            }
        }
    }
}
