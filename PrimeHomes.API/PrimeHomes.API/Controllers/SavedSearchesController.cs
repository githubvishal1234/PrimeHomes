using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PrimeHomes.API.Data;
using PrimeHomes.API.Models;

namespace PrimeHomes.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Buyer")]
    public class SavedSearchesController : ControllerBase
    {
        private const int MaxPerUser = 20;
        private readonly PrimeHomesDbContext _context;

        public SavedSearchesController(PrimeHomesDbContext context)
        {
            _context = context;
        }

        public class SaveSearchRequest
        {
            [Required, StringLength(120, MinimumLength = 2)]
            public string Name { get; set; } = string.Empty;

            [Required, StringLength(1000)]
            public string Query { get; set; } = string.Empty;
        }

        public class AlertsRequest
        {
            public bool Enabled { get; set; }
        }

        private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpGet]
        public async Task<IActionResult> GetMine()
        {
            var userId = UserId;
            return Ok(await _context.SavedSearches
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.CreatedDate)
                .ToListAsync());
        }

        [HttpPost]
        public async Task<IActionResult> Save(SaveSearchRequest request)
        {
            var userId = UserId;
            var query = request.Query.Trim().TrimStart('?');

            if (await _context.SavedSearches.AnyAsync(s => s.UserId == userId && s.Query == query))
                return Conflict(new { message = "You have already saved this search." });

            if (await _context.SavedSearches.CountAsync(s => s.UserId == userId) >= MaxPerUser)
                return Conflict(new { message = $"You can keep up to {MaxPerUser} saved searches. Delete one to add another." });

            var saved = new SavedSearch { UserId = userId, Name = request.Name.Trim(), Query = query };
            _context.SavedSearches.Add(saved);
            await _context.SaveChangesAsync();

            return Ok(saved);
        }

        [HttpPut("{id:int}/alerts")]
        public async Task<IActionResult> SetAlerts(int id, AlertsRequest request)
        {
            var userId = UserId;
            var updated = await _context.SavedSearches
                .Where(s => s.SavedSearchId == id && s.UserId == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.AlertsEnabled, request.Enabled));

            return updated == 0 ? NotFound(new { message = "Saved search not found." }) : Ok(new { enabled = request.Enabled });
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = UserId;
            var deleted = await _context.SavedSearches
                .Where(s => s.SavedSearchId == id && s.UserId == userId)
                .ExecuteDeleteAsync();

            return deleted == 0 ? NotFound(new { message = "Saved search not found." }) : Ok(new { message = "Saved search deleted." });
        }
    }
}
