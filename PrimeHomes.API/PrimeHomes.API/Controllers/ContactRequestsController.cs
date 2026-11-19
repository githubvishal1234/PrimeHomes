using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PrimeHomes.API.Data;
using PrimeHomes.API.Models;
using System.Security.Claims;
using Microsoft.AspNetCore.RateLimiting;
using PrimeHomes.API.Services;

namespace PrimeHomes.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ContactRequestsController : ControllerBase
    {
        private readonly PrimeHomesDbContext _context;
        private readonly Notifier _notifier;

        public ContactRequestsController(PrimeHomesDbContext context, Notifier notifier)
        {
            _context = context;
            _notifier = notifier;
        }


        // =========================================================
        // CREATE CONTACT / CALLBACK REQUEST
        // =========================================================

        [HttpPost]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> CreateContactRequest(ContactRequest request)
        {
            // Never trust ids or status from the body; link the account only when signed in.
            request.ContactRequestId = 0;
            request.UserId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null;
            request.Status = "New";
            request.CreatedDate = DateTime.UtcNow;

            _context.ContactRequests.Add(request);
            await _context.SaveChangesAsync();

            await _notifier.NotifyRoleAsync("Admin", "New contact request",
                $"{request.FullName} ({request.InterestedIn}) asked for a callback.",
                "ContactRequestReceived", request.PropertyId);

            return Ok(new
            {
                message = "Your callback request has been submitted successfully.",
                contactRequestId = request.ContactRequestId
            });
        }


        // =========================================================
        // GET ALL CONTACT REQUESTS
        // ADMIN USE
        // =========================================================

        [Authorize(Roles = "Admin")]
        [HttpGet]
        public async Task<IActionResult> GetContactRequests()
        {
            var requests = await _context.ContactRequests
                .OrderByDescending(x => x.CreatedDate)
                .ToListAsync();

            return Ok(requests);
        }


        // =========================================================
        // GET SINGLE CONTACT REQUEST
        // ADMIN USE
        // =========================================================

        [Authorize(Roles = "Admin")]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetContactRequest(
            int id)
        {
            var request =
                await _context.ContactRequests
                    .FirstOrDefaultAsync(
                        x => x.ContactRequestId == id);

            if (request == null)
            {
                return NotFound(new
                {
                    message = "Contact request not found."
                });
            }

            return Ok(request);
        }


        // =========================================================
        // UPDATE REQUEST STATUS
        // ADMIN USE
        // =========================================================

        [Authorize(Roles = "Admin")]
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(
            int id,
            [FromBody] string status)
        {
            var request =
                await _context.ContactRequests
                    .FirstOrDefaultAsync(
                        x => x.ContactRequestId == id);

            if (request == null)
            {
                return NotFound(new
                {
                    message = "Contact request not found."
                });
            }


            // -------------------------------------------------
            // Allowed statuses
            // -------------------------------------------------

            var allowedStatuses = new[]
            {
                "New",
                "Contacted",
                "Closed"
            };


            if (!allowedStatuses.Contains(
                status,
                StringComparer.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    message =
                        "Invalid status. Use New, Contacted or Closed."
                });
            }


            request.Status = status;

            await _context.SaveChangesAsync();


            return Ok(new
            {
                message =
                    "Contact request status updated successfully."
            });
        }
    }
}