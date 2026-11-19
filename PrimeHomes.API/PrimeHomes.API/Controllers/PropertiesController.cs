using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PrimeHomes.API.Data;
using PrimeHomes.API.Models;
using PrimeHomes.API.Services;

namespace PrimeHomes.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PropertiesController : ControllerBase
    {
        private readonly PrimeHomesDbContext _context;
        private readonly IWebHostEnvironment _environment;
        private readonly Notifier _notifier;
        private readonly ListingAlerts _alerts;

        public PropertiesController(PrimeHomesDbContext context, IWebHostEnvironment environment, Notifier notifier, ListingAlerts alerts)
        {
            _context = context;
            _environment = environment;
            _notifier = notifier;
            _alerts = alerts;
        }

        private int? CurrentUserId =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        // ==========================================
        // PUBLIC READS
        // ==========================================

        // GET: api/Properties — all live listings (kept for existing screens; new UI uses /search)
        [HttpGet]
        public async Task<IActionResult> GetProperties()
        {
            var properties = await _context.Properties
                .AsNoTracking()
                .Where(p => p.Status == PropertyStatus.Approved)
                .OrderByDescending(p => p.CreatedDate)
                .ToListAsync();

            return Ok(properties);
        }

        // GET: api/Properties/search?city=Hyderabad&bhk=2,3&maxPrice=8000000&sort=price_asc&page=1
        [HttpGet("search")]
        public async Task<ActionResult<PagedResult<PropertySummary>>> Search([FromQuery] PropertySearchQuery query)
        {
            var q = _context.Properties.AsNoTracking().Where(p => p.Status == PropertyStatus.Approved);

            q = PropertySearch.Apply(q, query);

            q = query.Sort switch
            {
                "newest" => q.OrderByDescending(p => p.CreatedDate),
                "price_asc" => q.OrderBy(p => p.Price),
                "price_desc" => q.OrderByDescending(p => p.Price),
                "price_per_sqft" => q.OrderBy(p => p.Area > 0 ? p.Price / p.Area : p.Price),
                "area_desc" => q.OrderByDescending(p => p.Area),
                // relevance: promoted and verified first, then freshest
                _ => q.OrderByDescending(p => p.Badge != null)
                      .ThenByDescending(p => p.IsVerified)
                      .ThenByDescending(p => p.ApprovedDate ?? p.CreatedDate)
            };

            var total = await q.CountAsync();

            var items = await ToSummaries(q.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize))
                .ToListAsync();

            return Ok(new PagedResult<PropertySummary>(items, total, query.Page, query.PageSize));
        }

        // GET: api/Properties/cities — live listing count per city, for search suggestions
        [HttpGet("cities")]
        public async Task<IActionResult> GetCities()
        {
            var cities = await _context.Properties
                .AsNoTracking()
                .Where(p => p.Status == PropertyStatus.Approved)
                .GroupBy(p => p.City)
                .Select(g => new { City = g.Key, Count = g.Count(), Localities = g.Select(p => p.Location).Distinct().ToList() })
                .OrderByDescending(c => c.Count)
                .ToListAsync();

            return Ok(cities);
        }

        // GET: api/Properties/5
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetPropertyById(int id)
        {
            var property = await _context.Properties
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.PropertyId == id);

            // Only live listings are public; the owner and admins can also see the other states.
            var isOwner = property != null && CurrentUserId == property.OwnerId;
            var isAdmin = User.IsInRole("Admin");

            if (property == null || (property.Status != PropertyStatus.Approved && !isOwner && !isAdmin))
            {
                return NotFound(new { message = "Property not found." });
            }

            if (property.Status == PropertyStatus.Approved && !isOwner && !isAdmin)
            {
                await _context.Properties
                    .Where(p => p.PropertyId == id)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.ViewCount, p => p.ViewCount + 1));

                await CountDailyViewAsync(id);
            }

            return Ok(property);
        }

        // GET: api/Properties/5/similar — same city, type and listing type, price within ±30%
        [HttpGet("{id:int}/similar")]
        public async Task<ActionResult<IReadOnlyList<PropertySummary>>> GetSimilar(int id, [FromQuery] int take = 6)
        {
            var source = await _context.Properties.AsNoTracking().FirstOrDefaultAsync(p => p.PropertyId == id);
            if (source == null)
            {
                return NotFound(new { message = "Property not found." });
            }

            var low = source.Price * 0.7m;
            var high = source.Price * 1.3m;

            var similar = await ToSummaries(_context.Properties.AsNoTracking()
                    .Where(p => p.PropertyId != id
                        && p.Status == PropertyStatus.Approved
                        && p.City == source.City
                        && p.ListingType == source.ListingType
                        && p.PropertyType == source.PropertyType
                        && p.Price >= low && p.Price <= high)
                    .OrderBy(p => p.BHK == source.BHK ? 0 : 1)
                    .ThenByDescending(p => p.CreatedDate)
                    .Take(Math.Clamp(take, 1, 12)))
                .ToListAsync();

            return Ok(similar);
        }

        // ==========================================
        // OWNER
        // ==========================================

        // GET: api/Properties/5/owner — who posted a live listing. Contact details stay private:
        // buyers reach owners through inquiries, and phones are shared once a site visit is confirmed.
        [HttpGet("{id:int}/owner")]
        public async Task<IActionResult> GetOwnerSummary(int id)
        {
            var summary = await _context.Properties.AsNoTracking()
                .Where(p => p.PropertyId == id && p.Status == PropertyStatus.Approved)
                .Join(_context.Users, p => p.OwnerId, u => u.UserId, (p, u) => new { u.UserId, u.Name, u.CreatedDate })
                .FirstOrDefaultAsync();

            if (summary == null)
                return NotFound(new { message = "Owner not found." });

            var parts = summary.Name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var displayName = parts.Length > 1 ? $"{parts[0]} {parts[^1][0]}." : parts.FirstOrDefault() ?? "Owner";

            return Ok(new
            {
                DisplayName = displayName,
                MemberSince = summary.CreatedDate,
                LiveListings = await _context.Properties.CountAsync(p => p.OwnerId == summary.UserId && p.Status == PropertyStatus.Approved)
            });
        }

        // GET: api/Properties/5/insights — how this price compares with the locality and city
        [HttpGet("{id:int}/insights")]
        public async Task<IActionResult> GetInsights(int id)
        {
            var p = await _context.Properties.AsNoTracking().FirstOrDefaultAsync(x => x.PropertyId == id && x.Status == PropertyStatus.Approved);
            if (p == null || p.Area <= 0)
                return NotFound(new { message = "No insights for this property." });

            var peers = _context.Properties.AsNoTracking()
                .Where(x => x.Status == PropertyStatus.Approved && x.ListingType == p.ListingType && x.Area > 0 && x.PropertyId != id);

            async Task<(int Count, decimal? Avg)> Stats(IQueryable<Property> q) =>
                (await q.CountAsync(), await q.Select(x => (decimal?)(x.Price / x.Area)).AverageAsync());

            var locality = await Stats(peers.Where(x => x.City == p.City && x.Location == p.Location));
            var city = await Stats(peers.Where(x => x.City == p.City));

            var thisRate = p.Price / p.Area;
            // Compare with the locality when it has enough listings, otherwise the city.
            var (scope, basis) = locality.Count >= 2 ? ("locality", locality.Avg) : city.Count >= 2 ? ("city", city.Avg) : (null, null);
            string? verdict = null;
            if (basis is { } avg && avg > 0)
            {
                var diff = (thisRate - avg) / avg;
                verdict = diff < -0.10m ? "Below market" : diff > 0.10m ? "Above market" : "Fair price";
            }

            return Ok(new
            {
                ListingType = p.ListingType,
                PricePerSqft = Math.Round(thisRate, 0),
                LocalityAvg = locality.Avg is { } la ? Math.Round(la, 0) : (decimal?)null,
                LocalityCount = locality.Count,
                CityAvg = city.Avg is { } ca ? Math.Round(ca, 0) : (decimal?)null,
                CityCount = city.Count,
                ComparedWith = scope,
                Verdict = verdict
            });
        }

        // GET: api/Properties/my-analytics?days=30 — daily views, inquiries and visits across the owner's listings
        [Authorize(Roles = "Owner")]
        [HttpGet("my-analytics")]
        public async Task<IActionResult> GetMyAnalytics([FromQuery] int days = 30)
        {
            days = Math.Clamp(days, 7, 90);
            var ownerId = CurrentUserId;
            var from = DateTime.UtcNow.Date.AddDays(1 - days);
            var ids = await _context.Properties.Where(p => p.OwnerId == ownerId).Select(p => p.PropertyId).ToListAsync();

            var views = await _context.PropertyViewsDaily
                .Where(v => ids.Contains(v.PropertyId) && v.Day >= from)
                .GroupBy(v => v.Day).Select(g => new { Day = g.Key, Count = g.Sum(x => x.Views) })
                .ToDictionaryAsync(x => x.Day, x => x.Count);

            var inquiries = await _context.Inquiries
                .Where(i => i.OwnerId == ownerId && i.CreatedDate >= from)
                .GroupBy(i => i.CreatedDate.Date).Select(g => new { Day = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Day, x => x.Count);

            var visits = await _context.SiteVisits
                .Where(v => v.OwnerId == ownerId && v.CreatedDate >= from)
                .GroupBy(v => v.CreatedDate.Date).Select(g => new { Day = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Day, x => x.Count);

            var series = Enumerable.Range(0, days).Select(i => from.AddDays(i)).Select(day => new
            {
                Date = day.ToString("yyyy-MM-dd"),
                Views = views.GetValueOrDefault(day),
                Inquiries = inquiries.GetValueOrDefault(day),
                Visits = visits.GetValueOrDefault(day)
            }).ToList();

            return Ok(new
            {
                Days = days,
                Series = series,
                Totals = new
                {
                    Views = series.Sum(x => x.Views),
                    Inquiries = series.Sum(x => x.Inquiries),
                    Visits = series.Sum(x => x.Visits)
                }
            });
        }

        [Authorize(Roles = "Owner")]
        [HttpGet("my-properties")]
        public async Task<IActionResult> GetMyProperties()
        {
            var properties = await _context.Properties
                .AsNoTracking()
                .Where(p => p.OwnerId == CurrentUserId)
                .OrderByDescending(p => p.UpdatedDate ?? p.CreatedDate)
                .ToListAsync();

            return Ok(properties);
        }

        // GET: api/Properties/my-stats — per-listing engagement for the owner's dashboard
        [Authorize(Roles = "Owner")]
        [HttpGet("my-stats")]
        public async Task<IActionResult> GetMyStats()
        {
            var ownerId = CurrentUserId;

            var stats = await _context.Properties
                .AsNoTracking()
                .Where(p => p.OwnerId == ownerId)
                .Select(p => new
                {
                    p.PropertyId,
                    p.ViewCount,
                    Inquiries = _context.Inquiries.Count(i => i.PropertyId == p.PropertyId),
                    NewInquiries = _context.Inquiries.Count(i => i.PropertyId == p.PropertyId && i.Status == "New"),
                    Visits = _context.SiteVisits.Count(v => v.PropertyId == p.PropertyId && v.Status != SiteVisit.Cancelled),
                    Shortlists = _context.Favorites.Count(f => f.PropertyId == p.PropertyId)
                })
                .ToListAsync();

            return Ok(stats);
        }

        [Authorize(Roles = "Owner")]
        [HttpPost]
        public async Task<IActionResult> AddProperty(PropertyRequest request)
        {
            if (!request.SaveAsDraft && await _context.RequireVerifiedEmailAsync(CurrentUserId!.Value) is { } blocked)
                return blocked;

            var property = new Property
            {
                OwnerId = CurrentUserId!.Value,
                Status = request.SaveAsDraft ? PropertyStatus.Draft : PropertyStatus.Pending,
                CreatedDate = DateTime.UtcNow
            };
            request.ApplyTo(property);

            if (property.Status != PropertyStatus.Draft && IncompleteForReview(property) is { } incomplete)
                return incomplete;

            _context.Properties.Add(property);
            await _context.SaveChangesAsync();

            if (property.Status == PropertyStatus.Pending)
            {
                await NotifyAdminsOfReviewAsync(property);
            }

            return Ok(property);
        }

        [Authorize(Roles = "Owner")]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> UpdateProperty(int id, PropertyRequest request)
        {
            var property = await _context.Properties.FirstOrDefaultAsync(p => p.PropertyId == id);

            if (property == null)
                return NotFound(new { message = "Property not found." });

            if (property.OwnerId != CurrentUserId)
                return Forbid();

            if (!PropertyStatus.CanEdit(property.Status))
                return Conflict(new { message = $"A {property.Status.ToLowerInvariant()} listing can no longer be edited." });

            var previousStatus = property.Status;

            request.ApplyTo(property);
            property.Status = PropertyStatus.AfterEdit(previousStatus);

            if (property.Status != PropertyStatus.Draft && IncompleteForReview(property) is { } incomplete)
                return incomplete;
            property.RejectReason = null;
            property.UpdatedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            if (property.Status == PropertyStatus.Pending && previousStatus != PropertyStatus.Pending)
            {
                await NotifyAdminsOfReviewAsync(property);
            }

            return Ok(property);
        }

        // POST: api/Properties/5/submit — Draft, Rejected or Expired → Pending
        [Authorize(Roles = "Owner")]
        [HttpPost("{id:int}/submit")]
        public async Task<IActionResult> SubmitProperty(int id)
        {
            var property = await _context.Properties.FirstOrDefaultAsync(p => p.PropertyId == id);

            if (property == null)
                return NotFound(new { message = "Property not found." });

            if (property.OwnerId != CurrentUserId)
                return Forbid();

            if (await _context.RequireVerifiedEmailAsync(property.OwnerId) is { } blocked)
                return blocked;

            if (!PropertyStatus.CanSubmit(property.Status))
                return Conflict(new { message = $"A {property.Status.ToLowerInvariant()} listing cannot be submitted for review." });

            if (IncompleteForReview(property) is { } incomplete)
                return incomplete;

            property.Status = PropertyStatus.Pending;
            property.RejectReason = null;
            property.UpdatedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await NotifyAdminsOfReviewAsync(property);

            return Ok(property);
        }

        // PUT: api/Properties/5/close { "status": "Sold" | "Rented" }
        [Authorize(Roles = "Owner")]
        [HttpPut("{id:int}/close")]
        public async Task<IActionResult> CloseProperty(int id, ClosePropertyRequest request)
        {
            var property = await _context.Properties.FirstOrDefaultAsync(p => p.PropertyId == id);

            if (property == null)
                return NotFound(new { message = "Property not found." });

            if (property.OwnerId != CurrentUserId)
                return Forbid();

            if (!PropertyStatus.CanClose(property.Status, request.Status, property.ListingType))
                return Conflict(new { message = $"Only a live {property.ListingType.ToLowerInvariant()} listing can be marked {request.Status.ToLowerInvariant()}." });

            property.Status = request.Status;
            property.UpdatedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(property);
        }

        [Authorize(Roles = "Owner")]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteProperty(int id)
        {
            var property = await _context.Properties
                .Include(p => p.Images)
                .FirstOrDefaultAsync(p => p.PropertyId == id);

            if (property == null)
                return NotFound(new { message = "Property not found." });

            if (property.OwnerId != CurrentUserId)
                return Forbid();

            // Inquiries reference the property without a cascade rule; images, favorites and reviews cascade.
            await _context.Inquiries.Where(i => i.PropertyId == id).ExecuteDeleteAsync();

            var files = property.Images.Select(i => i.ImageUrl).Append(property.ImageUrl).ToList();

            _context.Properties.Remove(property);
            await _context.SaveChangesAsync();

            foreach (var file in files)
            {
                ImageStorage.Delete(file, _environment.WebRootPath);
            }

            return Ok(new { message = "Property deleted successfully." });
        }

        // ==========================================
        // ADMIN
        // ==========================================

        // GET: api/Properties/all?status=Pending
        [Authorize(Roles = "Admin")]
        [HttpGet("all")]
        public async Task<IActionResult> GetAllPropertiesForAdmin([FromQuery] string? status)
        {
            var q = _context.Properties.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(status))
                q = q.Where(p => p.Status == status);

            // Review queue reads oldest-first for pending; everything else newest-first.
            var properties = status == PropertyStatus.Pending
                ? await q.OrderBy(p => p.UpdatedDate ?? p.CreatedDate).ToListAsync()
                : await q.OrderByDescending(p => p.CreatedDate).ToListAsync();

            return Ok(properties);
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}/approve")]
        public async Task<IActionResult> ApproveProperty(int id)
        {
            var property = await _context.Properties.FirstOrDefaultAsync(p => p.PropertyId == id);

            if (property == null)
                return NotFound(new { message = "Property not found." });

            if (!PropertyStatus.CanApprove(property.Status))
                return Conflict(new { message = $"Only pending listings can be approved (this one is {property.Status.ToLowerInvariant()})." });

            var previousApprovedPrice = property.ApprovedPrice;

            property.Status = PropertyStatus.Approved;
            property.ApprovedDate = DateTime.UtcNow;
            property.ApprovedPrice = property.Price;
            property.RejectReason = null;

            await _context.SaveChangesAsync();

            await _notifier.NotifyAsync(property.OwnerId, "Property approved",
                $"Your property '{property.Title}' is now live and visible to buyers.",
                "PropertyApproved", property.PropertyId, email: true);

            await _alerts.OnApprovedAsync(property, previousApprovedPrice);

            return Ok(new { message = "Property approved successfully." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}/reject")]
        public async Task<IActionResult> RejectProperty(int id, RejectPropertyRequest request)
        {
            var property = await _context.Properties.FirstOrDefaultAsync(p => p.PropertyId == id);

            if (property == null)
                return NotFound(new { message = "Property not found." });

            if (!PropertyStatus.CanReject(property.Status))
                return Conflict(new { message = $"A {property.Status.ToLowerInvariant()} listing cannot be rejected." });

            property.Status = PropertyStatus.Rejected;
            property.RejectReason = request.Reason.Trim();

            await _context.SaveChangesAsync();

            await _notifier.NotifyAsync(property.OwnerId, "Property needs changes",
                $"Your property '{property.Title}' was not approved. Reason: {property.RejectReason} Edit it and resubmit for review.",
                "PropertyRejected", property.PropertyId, email: true);

            return Ok(new { message = "Property rejected successfully." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}/verify")]
        public async Task<IActionResult> VerifyProperty(int id, VerifyPropertyRequest request)
        {
            var updated = await _context.Properties
                .Where(p => p.PropertyId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsVerified, request.IsVerified));

            return updated == 0
                ? NotFound(new { message = "Property not found." })
                : Ok(new { message = request.IsVerified ? "Property marked verified." : "Verification removed.", isVerified = request.IsVerified });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}/badge")]
        public async Task<IActionResult> UpdatePropertyBadge(int id, [FromBody] UpdatePropertyBadgeDto request)
        {
            var property = await _context.Properties.FirstOrDefaultAsync(p => p.PropertyId == id);

            if (property == null)
                return NotFound(new { message = "Property not found." });

            var allowedBadges = new[] { "NEW", "FEATURED", "HOT PROPERTY", "PRICE DROP", "PREMIUM", "VERIFIED" };
            var badge = request.Badge?.Trim();

            if (!string.IsNullOrWhiteSpace(badge) && !allowedBadges.Contains(badge, StringComparer.OrdinalIgnoreCase))
                return BadRequest(new { message = "Invalid property badge." });

            property.Badge = string.IsNullOrWhiteSpace(badge) ? null : badge.ToUpperInvariant();

            await _context.SaveChangesAsync();

            return Ok(new { message = "Property badge updated successfully.", badge = property.Badge });
        }

        // ==========================================
        // HELPERS
        // ==========================================

        /// <summary>Adds one view to today's row for the listing (UTC day).</summary>
        private async Task CountDailyViewAsync(int propertyId)
        {
            var today = DateTime.UtcNow.Date;
            var bump = () => _context.PropertyViewsDaily
                .Where(v => v.PropertyId == propertyId && v.Day == today)
                .ExecuteUpdateAsync(s => s.SetProperty(v => v.Views, v => v.Views + 1));

            if (await bump() > 0) return;

            _context.PropertyViewsDaily.Add(new PropertyViewDaily { PropertyId = propertyId, Day = today, Views = 1 });
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Another request created today's row first; count this view on it.
                _context.ChangeTracker.Clear();
                await bump();
            }
        }

        /// <summary>400 with field errors when a listing lacks what reviewers need, else null.</summary>
        private ActionResult? IncompleteForReview(Property property)
        {
            var missing = PropertyRequest.MissingForReview(property);
            return missing.Count == 0 ? null : ValidationProblem(new ValidationProblemDetails(missing)
            {
                Title = "Complete the listing before sending it for review."
            });
        }

        private static IQueryable<PropertySummary> ToSummaries(IQueryable<Property> q) =>
            q.Select(p => new PropertySummary(
                p.PropertyId, p.Title, p.PropertyType, p.ListingType, p.BHK, p.Bathrooms,
                p.Price, p.Area, p.Area > 0 ? Math.Round(p.Price / p.Area, 0) : 0,
                p.Furnishing, p.ConstructionStatus, p.Location, p.City, p.Latitude, p.Longitude,
                p.ImageUrl, p.Images.Count, p.Badge, p.IsVerified, p.LifestyleFeatures, p.CreatedDate,
                p.Floor, p.TotalFloors, p.AgeYears,
                p.Description.Length > 160 ? p.Description.Substring(0, 157) + "..." : p.Description,
                p.ApprovedDate));


        private Task NotifyAdminsOfReviewAsync(Property property) =>
            _notifier.NotifyRoleAsync("Admin", "Listing awaiting review",
                $"'{property.Title}' in {property.City} is waiting for approval.",
                "PropertyPendingReview", property.PropertyId);
    }
}
