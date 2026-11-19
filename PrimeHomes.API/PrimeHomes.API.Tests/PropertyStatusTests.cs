using PrimeHomes.API.Models;
using static PrimeHomes.API.Models.PropertyStatus;

namespace PrimeHomes.API.Tests;

public class PropertyStatusTests
{
    [Theory]
    [InlineData(Draft, true)]
    [InlineData(Rejected, true)]
    [InlineData(Expired, true)]
    [InlineData(Pending, false)]
    [InlineData(Approved, false)]
    [InlineData(Sold, false)]
    public void Owner_can_submit_only_from_draft_rejected_or_expired(string from, bool expected) =>
        Assert.Equal(expected, CanSubmit(from));

    [Theory]
    [InlineData(Pending, true)]
    [InlineData(Draft, false)]
    [InlineData(Rejected, false)]
    [InlineData(Approved, false)]
    public void Admin_can_approve_only_pending(string from, bool expected) =>
        Assert.Equal(expected, CanApprove(from));

    [Theory]
    [InlineData(Pending, true)]
    [InlineData(Approved, true)]
    [InlineData(Draft, false)]
    [InlineData(Sold, false)]
    public void Admin_can_reject_pending_or_take_down_live(string from, bool expected) =>
        Assert.Equal(expected, CanReject(from));

    [Theory]
    [InlineData(Approved, Sold, "Sale", true)]
    [InlineData(Approved, Rented, "Rent", true)]
    [InlineData(Approved, Rented, "Sale", false)]
    [InlineData(Approved, Sold, "Rent", false)]
    [InlineData(Pending, Sold, "Sale", false)]
    public void Only_live_listings_close_and_only_with_matching_outcome(string from, string to, string listingType, bool expected) =>
        Assert.Equal(expected, CanClose(from, to, listingType));

    [Theory]
    [InlineData(Draft, Draft)]
    [InlineData(Approved, Pending)]
    [InlineData(Rejected, Pending)]
    [InlineData(Expired, Pending)]
    [InlineData(Pending, Pending)]
    public void Edits_send_listing_back_to_review_except_drafts(string from, string expected) =>
        Assert.Equal(expected, AfterEdit(from));

    [Theory]
    [InlineData(Sold, false)]
    [InlineData(Rented, false)]
    [InlineData(Approved, true)]
    [InlineData(Draft, true)]
    public void Closed_listings_cannot_be_edited(string from, bool expected) =>
        Assert.Equal(expected, CanEdit(from));
}

public class ReviewReadinessTests
{
    [Fact]
    public void Draft_with_only_a_title_is_missing_review_fields()
    {
        var missing = PropertyRequest.MissingForReview(new Property { Title = "Bright 2 BHK" });
        Assert.Equal(new[] { "Area", "City", "Location", "Price", "PropertyType" }, missing.Keys.OrderBy(k => k));
    }

    [Fact]
    public void Complete_listing_is_ready_for_review()
    {
        var p = new Property { Title = "Bright 2 BHK", PropertyType = "Apartment", Price = 5_000_000, Area = 1000, Location = "Kondapur", City = "Hyderabad" };
        Assert.Empty(PropertyRequest.MissingForReview(p));
    }
}
