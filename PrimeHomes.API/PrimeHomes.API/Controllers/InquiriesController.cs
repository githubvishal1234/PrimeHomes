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
    /// <summary>Buyer → owner messages. Status: New → Viewed (owner opened) → Responded → Closed.</summary>
    [Route("api/[controller]")]
    [ApiController]
    public class InquiriesController : ControllerBase
    {
        private static readonly string[] OwnerSettableStatuses = ["Viewed", "Closed"];

        private readonly PrimeHomesDbContext _context;
        private readonly Notifier _notifier;

        public InquiriesController(PrimeHomesDbContext context, Notifier notifier)
        {
            _context = context;
            _notifier = notifier;
        }

        public class CreateInquiryRequest
        {
            [Range(1, int.MaxValue)]
            public int PropertyId { get; set; }

            [Required, StringLength(1000, MinimumLength = 5, ErrorMessage = "Write a message of at least 5 characters.")]
            public string Message { get; set; } = string.Empty;
        }

        public class ReplyRequest
        {
            [Required, StringLength(1000, MinimumLength = 2)]
            public string Message { get; set; } = string.Empty;
        }

        private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // POST: api/Inquiries
        [Authorize(Roles = "Buyer")]
        [HttpPost]
        public async Task<IActionResult> AddInquiry(CreateInquiryRequest request)
        {
            var blocked = await _context.RequireVerifiedEmailAsync(UserId);
            if (blocked != null) return blocked;

            var property = await _context.Properties.AsNoTracking()
                .FirstOrDefaultAsync(p => p.PropertyId == request.PropertyId && p.Status == PropertyStatus.Approved);

            if (property == null)
                return NotFound(new { message = "This property is no longer available." });

            var inquiry = new Inquiry
            {
                PropertyId = property.PropertyId,
                BuyerId = UserId,
                OwnerId = property.OwnerId,
                Message = request.Message.Trim(),
                Status = "New",
                CreatedDate = DateTime.UtcNow
            };

            _context.Inquiries.Add(inquiry);
            await _context.SaveChangesAsync();

            await _notifier.NotifyAsync(property.OwnerId, "New inquiry",
                $"{User.Identity?.Name} asked about '{property.Title}': \"{Shorten(inquiry.Message)}\"",
                "InquiryReceived", property.PropertyId, email: true);

            return Ok(new { inquiry.InquiryId, inquiry.PropertyId, inquiry.Status, inquiry.CreatedDate });
        }

        // GET: api/Inquiries/my-inquiries — buyer
        [Authorize(Roles = "Buyer")]
        [HttpGet("my-inquiries")]
        public async Task<IActionResult> GetMyInquiries()
        {
            var buyerId = UserId;
            return Ok(await Project(_context.Inquiries.Where(i => i.BuyerId == buyerId)).ToListAsync());
        }

        // GET: api/Inquiries — owner; opening the list marks new inquiries as viewed
        [Authorize(Roles = "Owner")]
        [HttpGet]
        public async Task<IActionResult> GetInquiries()
        {
            var ownerId = UserId;

            var inquiries = await Project(_context.Inquiries.Where(i => i.OwnerId == ownerId)).ToListAsync();

            await _context.Inquiries
                .Where(i => i.OwnerId == ownerId && i.Status == "New")
                .ExecuteUpdateAsync(s => s.SetProperty(i => i.Status, "Viewed"));

            return Ok(inquiries);
        }

        // POST: api/Inquiries/5/reply — owner
        [Authorize(Roles = "Owner")]
        [HttpPost("{id:int}/reply")]
        public async Task<IActionResult> Reply(int id, ReplyRequest request)
        {
            var inquiry = await _context.Inquiries.Include(i => i.Property).FirstOrDefaultAsync(i => i.InquiryId == id);

            if (inquiry == null)
                return NotFound(new { message = "Inquiry not found." });

            if (inquiry.OwnerId != UserId)
                return Forbid();

            if (inquiry.Status == "Closed")
                return Conflict(new { message = "This inquiry is closed." });

            inquiry.OwnerReply = request.Message.Trim();
            inquiry.RespondedDate = DateTime.UtcNow;
            inquiry.Status = "Responded";
            await _context.SaveChangesAsync();

            await _notifier.NotifyAsync(inquiry.BuyerId, "The owner replied",
                $"Reply about '{inquiry.Property?.Title}': \"{Shorten(inquiry.OwnerReply)}\"",
                "InquiryResponded", inquiry.PropertyId, email: true);

            return Ok(new { message = "Reply sent.", inquiry.InquiryId, inquiry.Status, inquiry.OwnerReply, inquiry.RespondedDate });
        }

        // PUT: api/Inquiries/5 { "status": "Viewed" | "Closed" } — owner
        [Authorize(Roles = "Owner")]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> UpdateInquiryStatus(int id, [FromBody] UpdateInquiryStatusDto dto)
        {
            var inquiry = await _context.Inquiries.FirstOrDefaultAsync(i => i.InquiryId == id);

            if (inquiry == null)
                return NotFound(new { message = "Inquiry not found." });

            if (inquiry.OwnerId != UserId)
                return Forbid();

            // "Responded" is set by replying, so the buyer always gets the owner's answer.
            var status = OwnerSettableStatuses.FirstOrDefault(s => s.Equals(dto.Status?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (status == null)
                return BadRequest(new { message = "Status must be Viewed or Closed. Use reply to respond." });

            inquiry.Status = status;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Inquiry status updated successfully.", inquiryId = inquiry.InquiryId, status = inquiry.Status });
        }

        private IQueryable<InquiryResponseDto> Project(IQueryable<Inquiry> q) =>
            q.OrderByDescending(i => i.CreatedDate)
             .Select(i => new InquiryResponseDto
             {
                 InquiryId = i.InquiryId,
                 PropertyId = i.PropertyId,
                 PropertyTitle = i.Property!.Title,
                 BuyerId = i.BuyerId,
                 OwnerId = i.OwnerId,
                 BuyerName = _context.Users.Where(u => u.UserId == i.BuyerId).Select(u => u.Name).FirstOrDefault(),
                 Message = i.Message,
                 Status = i.Status,
                 OwnerReply = i.OwnerReply,
                 RespondedDate = i.RespondedDate,
                 CreatedDate = i.CreatedDate
             });

        private static string Shorten(string text) => text.Length <= 120 ? text : text[..117] + "...";
    }
}
