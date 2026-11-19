using PrimeHomes.API.Models;

namespace PrimeHomes.API.Tests;

public class SiteVisitTests
{
    // 2026-11-18 06:00 UTC = 11:30 IST
    private static readonly DateTime Now = new(2026, 11, 18, 6, 0, 0, DateTimeKind.Utc);

    private static DateTime Ist(int day, int hour, int minute = 0) =>
        new DateTime(2026, 11, day, hour, minute, 0, DateTimeKind.Utc) - SiteVisit.IndiaOffset;

    [Theory]
    [InlineData(19, 9)]
    [InlineData(19, 18)]
    [InlineData(18, 14)]
    public void Hourly_slots_inside_visiting_hours_are_bookable(int day, int hour) =>
        Assert.Null(SiteVisit.ValidateSlot(Ist(day, hour), Now));

    [Theory]
    [InlineData(19, 8)]
    [InlineData(19, 19)]
    public void Slots_outside_9_to_18_IST_are_rejected(int day, int hour) =>
        Assert.NotNull(SiteVisit.ValidateSlot(Ist(day, hour), Now));

    [Fact]
    public void Half_hour_slots_are_rejected() =>
        Assert.NotNull(SiteVisit.ValidateSlot(Ist(19, 10, 30), Now));

    [Fact]
    public void Slots_less_than_two_hours_away_are_rejected() =>
        Assert.NotNull(SiteVisit.ValidateSlot(Ist(18, 13), Now)); // 13:00 IST is 1.5h after 11:30 IST

    [Fact]
    public void Slots_more_than_60_days_ahead_are_rejected() =>
        Assert.NotNull(SiteVisit.ValidateSlot(Now.AddDays(61), Now));

    [Theory]
    [InlineData(SiteVisit.Requested, true)]
    [InlineData(SiteVisit.Rescheduled, true)]
    [InlineData(SiteVisit.Accepted, true)]
    [InlineData(SiteVisit.Completed, false)]
    [InlineData(SiteVisit.Cancelled, false)]
    public void Active_states(string status, bool expected) =>
        Assert.Equal(expected, SiteVisit.IsActive(status));
}

public class SeoAndAlertTests
{
    [Theory]
    [InlineData("Spacious 3 BHK with lake view in Kondapur", "Hyderabad", "spacious-3-bhk-with-lake-view-in-kondapur-hyderabad")]
    [InlineData("Sea-facing 3 BHK on Beach Road, Visakhapatnam", "Visakhapatnam", "sea-facing-3-bhk-on-beach-road-visakhapatnam")]
    public void Slugs_are_readable_and_include_the_city_once(string title, string city, string expected) =>
        Assert.Equal(expected, PrimeHomes.API.Services.Slug.For(title, city));

    [Fact]
    public void Saved_search_query_uses_the_search_page_parameter_names()
    {
        var q = PrimeHomes.API.Services.ListingAlerts.ParseQuery("?type=rent&city=Hyderabad&bhk=2,3&maxPrice=40000&verified=1&status=Ready%20to%20move");
        Assert.Equal("Rent", q.ListingType);
        Assert.Equal("Hyderabad", q.City);
        Assert.Equal("2,3", q.Bhk);
        Assert.Equal(40000m, q.MaxPrice);
        Assert.True(q.VerifiedOnly);
        Assert.Equal("Ready to move", q.ConstructionStatus);
        Assert.Equal("Sale", PrimeHomes.API.Services.ListingAlerts.ParseQuery("city=Pune").ListingType);
    }
}

public class DuplicateCheckTests
{
    private static Property Listing(int id, int owner, decimal price = 9_500_000, decimal area = 1650, string image = "/uploads/a.jpg") => new()
    {
        PropertyId = id, OwnerId = owner, City = "Hyderabad", Location = "Kondapur", BHK = 3,
        ListingType = "Sale", Price = price, Area = area, ImageUrl = image
    };

    [Fact]
    public void Same_photo_is_flagged() =>
        Assert.Equal("Same main photo", PrimeHomes.API.Services.DuplicateCheck.Reason(Listing(1, 1), Listing(2, 2, price: 1)));

    [Fact]
    public void Same_place_size_and_price_within_5_percent_is_flagged() =>
        Assert.NotNull(PrimeHomes.API.Services.DuplicateCheck.Reason(Listing(1, 1, image: "/x.jpg"), Listing(2, 2, price: 9_800_000, area: 1700, image: "/y.jpg")));

    [Fact]
    public void Different_price_is_not_flagged() =>
        Assert.Null(PrimeHomes.API.Services.DuplicateCheck.Reason(Listing(1, 1, image: "/x.jpg"), Listing(2, 2, price: 12_000_000, image: "/y.jpg")));
}
