using System.ComponentModel.DataAnnotations;
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
    [Authorize]
    public class SiteVisitsController : ControllerBase
    {
        private readonly PrimeHomesDbContext _context;
        private readonly Notifier _notifier;

        public SiteVisitsController(PrimeHomesDbContext context, Notifier notifier)
        {
            _context = context;
            _notifier = notifier;
        }

        public class BookVisitRequest
        {
            [Range(1, int.MaxValue)]
            public int PropertyId { get; set; }

            /// <summary>UTC (ISO 8601 with Z or offset).</summary>
            public DateTime ScheduledAt { get; set; }

            [StringLength(500)]
            public string? Note { get; set; }
        }

        public class RescheduleRequest
        {
            public DateTime ScheduledAt { get; set; }
        }

        private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // GET: api/SiteVisits — buyer sees own requests, owner sees requests for own listings
        [HttpGet]
        public async Task<IActionResult> GetMine()
        {
            var userId = UserId;
            var asOwner = User.IsInRole("Owner");

            var visits = await _context.SiteVisits
                .AsNoTracking()
                .Where(v => asOwner ? v.OwnerId == userId : v.BuyerId == userId)
                .OrderBy(v => v.Status == SiteVisit.Completed || v.Status == SiteVisit.Cancelled)
                .ThenBy(v => v.ScheduledAt)
                .Select(v => new
                {
                    v.SiteVisitId,
                    v.PropertyId,
                    PropertyTitle = v.Property!.Title,
                    PropertyLocation = v.Property.Location + ", " + v.Property.City,
                    PropertyImageUrl = v.Property.ImageUrl,
                    v.ScheduledAt,
                    v.Status,
                    v.Note,
                    CounterpartName = _context.Users
                        .Where(u => u.UserId == (asOwner ? v.BuyerId : v.OwnerId))
                        .Select(u => u.Name)
                        .FirstOrDefault(),
                    // Phone is shared only once a visit is confirmed.
                    CounterpartPhone = v.Status == SiteVisit.Accepted
                        ? _context.Users.Where(u => u.UserId == (asOwner ? v.BuyerId : v.OwnerId)).Select(u => u.Phone).FirstOrDefault()
                        : null,
                    v.CreatedDate
                })
                .ToListAsync();

            return Ok(visits);
        }

        // POST: api/SiteVisits
        [Authorize(Roles = "Buyer")]
        [HttpPost]
        public async Task<IActionResult> Book(BookVisitRequest request)
        {
            var blocked = await _context.RequireVerifiedEmailAsync(UserId);
            if (blocked != null) return blocked;

            var scheduledAt = request.ScheduledAt.ToUniversalTime();
            var slotError = SiteVisit.ValidateSlot(scheduledAt, DateTime.UtcNow);
            if (slotError != null)
                return BadRequest(new { message = slotError });

            var property = await _context.Properties.AsNoTracking()
                .FirstOrDefaultAsync(p => p.PropertyId == request.PropertyId && p.Status == PropertyStatus.Approved);
            if (property == null)
                return NotFound(new { message = "This property is not available for visits." });

            var userId = UserId;
            var alreadyActive = await _context.SiteVisits.AnyAsync(v =>
                v.PropertyId == property.PropertyId && v.BuyerId == userId &&
                (v.Status == SiteVisit.Requested || v.Status == SiteVisit.Rescheduled || v.Status == SiteVisit.Accepted));
            if (alreadyActive)
                return Conflict(new { message = "You already have an upcoming visit for this property." });

            var visit = new SiteVisit
            {
                PropertyId = property.PropertyId,
                BuyerId = userId,
                OwnerId = property.OwnerId,
                ScheduledAt = scheduledAt,
                Note = request.Note?.Trim(),
                CreatedDate = DateTime.UtcNow
            };
            _context.SiteVisits.Add(visit);
            await _context.SaveChangesAsync();

            await _notifier.NotifyAsync(property.OwnerId, "New site visit request",
                $"{User.Identity?.Name} wants to visit '{property.Title}' on {Ist(scheduledAt)}. Accept or suggest another time.",
                "SiteVisitRequested", property.PropertyId, email: true);

            return Ok(visit);
        }

        // PUT: api/SiteVisits/5/accept — owner accepts a request; buyer accepts the owner's new time
        [HttpPut("{id:int}/accept")]
        public async Task<IActionResult> Accept(int id)
        {
            var visit = await Load(id);
            if (visit == null) return NotFound(new { message = "Visit not found." });

            var userId = UserId;
            var ownerAccepting = visit.OwnerId == userId && visit.Status == SiteVisit.Requested;
            var buyerAccepting = visit.BuyerId == userId && visit.Status == SiteVisit.Rescheduled;

            if (!ownerAccepting && !buyerAccepting)
                return Conflict(new { message = "This visit cannot be accepted right now." });

            visit.Status = SiteVisit.Accepted;
            visit.UpdatedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await _notifier.NotifyAsync(ownerAccepting ? visit.BuyerId : visit.OwnerId, "Site visit confirmed",
                $"Your visit to '{visit.Property!.Title}' is confirmed for {Ist(visit.ScheduledAt)}.",
                "SiteVisitAccepted", visit.PropertyId, email: true);

            return Ok(visit);
        }

        // PUT: api/SiteVisits/5/reschedule — owner proposes a different time
        [Authorize(Roles = "Owner")]
        [HttpPut("{id:int}/reschedule")]
        public async Task<IActionResult> Reschedule(int id, RescheduleRequest request)
        {
            var visit = await Load(id);
            if (visit == null) return NotFound(new { message = "Visit not found." });
            if (visit.OwnerId != UserId) return Forbid();

            if (visit.Status is not (SiteVisit.Requested or SiteVisit.Accepted or SiteVisit.Rescheduled))
                return Conflict(new { message = "This visit can no longer be rescheduled." });

            var scheduledAt = request.ScheduledAt.ToUniversalTime();
            var slotError = SiteVisit.ValidateSlot(scheduledAt, DateTime.UtcNow);
            if (slotError != null)
                return BadRequest(new { message = slotError });

            visit.ScheduledAt = scheduledAt;
            visit.Status = SiteVisit.Rescheduled;
            visit.ReminderSent = false;
            visit.UpdatedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await _notifier.NotifyAsync(visit.BuyerId, "New time suggested for your visit",
                $"The owner of '{visit.Property!.Title}' suggested {Ist(scheduledAt)}. Accept it or cancel the visit.",
                "SiteVisitRescheduled", visit.PropertyId, email: true);

            return Ok(visit);
        }

        // PUT: api/SiteVisits/5/cancel — either party, before completion
        [HttpPut("{id:int}/cancel")]
        public async Task<IActionResult> Cancel(int id)
        {
            var visit = await Load(id);
            if (visit == null) return NotFound(new { message = "Visit not found." });

            var userId = UserId;
            if (visit.BuyerId != userId && visit.OwnerId != userId) return Forbid();

            if (!SiteVisit.IsActive(visit.Status))
                return Conflict(new { message = "This visit is already closed." });

            visit.Status = SiteVisit.Cancelled;
            visit.UpdatedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var cancelledByOwner = visit.OwnerId == userId;
            await _notifier.NotifyAsync(cancelledByOwner ? visit.BuyerId : visit.OwnerId, "Site visit cancelled",
                $"The visit to '{visit.Property!.Title}' on {Ist(visit.ScheduledAt)} was cancelled by the {(cancelledByOwner ? "owner" : "buyer")}.",
                "SiteVisitCancelled", visit.PropertyId, email: true);

            return Ok(visit);
        }

        // PUT: api/SiteVisits/5/complete — owner, once the visit time has passed
        [Authorize(Roles = "Owner")]
        [HttpPut("{id:int}/complete")]
        public async Task<IActionResult> Complete(int id)
        {
            var visit = await Load(id);
            if (visit == null) return NotFound(new { message = "Visit not found." });
            if (visit.OwnerId != UserId) return Forbid();

            if (visit.Status != SiteVisit.Accepted || visit.ScheduledAt > DateTime.UtcNow)
                return Conflict(new { message = "Only a confirmed visit whose time has passed can be marked completed." });

            visit.Status = SiteVisit.Completed;
            visit.UpdatedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await _notifier.NotifyAsync(visit.BuyerId, "How was your visit?",
                $"Thanks for visiting '{visit.Property!.Title}'. Share a review to help other buyers.",
                "SiteVisitCompleted", visit.PropertyId);

            return Ok(visit);
        }

        private Task<SiteVisit?> Load(int id) =>
            _context.SiteVisits.Include(v => v.Property).FirstOrDefaultAsync(v => v.SiteVisitId == id);

        private static string Ist(DateTime utc) => (utc + SiteVisit.IndiaOffset).ToString("ddd d MMM yyyy, h:mm tt") + " IST";
    }
}
