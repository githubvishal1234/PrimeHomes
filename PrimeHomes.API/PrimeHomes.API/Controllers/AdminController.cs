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
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly PrimeHomesDbContext _context;

        public AdminController(PrimeHomesDbContext context)
        {
            _context = context;
        }

        // GET: api/Admin/stats — platform health at a glance
        [HttpGet("stats")]
        public async Task<IActionResult> Stats()
        {
            var since = DateTime.UtcNow.AddDays(-30);

            return Ok(new
            {
                Users = await _context.Users.GroupBy(u => u.Role).Select(g => new { Role = g.Key, Count = g.Count() }).ToListAsync(),
                NewUsers30d = await _context.Users.CountAsync(u => u.CreatedDate >= since),
                Listings = await _context.Properties.GroupBy(p => p.Status).Select(g => new { Status = g.Key, Count = g.Count() }).ToListAsync(),
                Approved30d = await _context.Properties.CountAsync(p => p.ApprovedDate >= since),
                Inquiries30d = await _context.Inquiries.CountAsync(i => i.CreatedDate >= since),
                Visits30d = await _context.SiteVisits.CountAsync(v => v.CreatedDate >= since),
                SavedSearches = await _context.SavedSearches.CountAsync(),
                OpenContactRequests = await _context.ContactRequests.CountAsync(c => c.Status == "New"),
                TopCities = await _context.Properties
                    .Where(p => p.Status == PropertyStatus.Approved)
                    .GroupBy(p => p.City)
                    .Select(g => new { City = g.Key, Count = g.Count() })
                    .OrderByDescending(c => c.Count)
                    .Take(5)
                    .ToListAsync()
            });
        }

        // GET: api/Admin/duplicate-flags — pending listings that look like copies of another listing
        [HttpGet("duplicate-flags")]
        public async Task<IActionResult> DuplicateFlags()
        {
            var pending = await _context.Properties.AsNoTracking()
                .Where(p => p.Status == PropertyStatus.Pending)
                .ToListAsync();

            // Compare with everything that is (or was) visible to buyers, plus other pending listings.
            var others = await _context.Properties.AsNoTracking()
                .Where(p => p.Status != PropertyStatus.Draft && p.Status != PropertyStatus.Rejected)
                .Select(p => new Property
                {
                    PropertyId = p.PropertyId, OwnerId = p.OwnerId, Title = p.Title, City = p.City, Location = p.Location,
                    BHK = p.BHK, Price = p.Price, Area = p.Area, ImageUrl = p.ImageUrl, ListingType = p.ListingType
                })
                .ToListAsync();

            var flags = pending
                .Select(p => new
                {
                    p.PropertyId,
                    Matches = others
                        .Where(o => o.PropertyId != p.PropertyId)
                        .Select(o => new { o.PropertyId, o.Title, Reason = DuplicateCheck.Reason(p, o) })
                        .Where(m => m.Reason != null)
                        .ToList()
                })
                .Where(f => f.Matches.Count > 0)
                .ToList();

            return Ok(flags);
        }
    }
}
