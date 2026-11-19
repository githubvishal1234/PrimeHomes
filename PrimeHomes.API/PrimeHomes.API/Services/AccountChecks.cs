using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PrimeHomes.API.Data;

namespace PrimeHomes.API.Services
{
    public static class AccountChecks
    {
        /// <summary>
        /// Contacting owners and publishing listings need a verified email (checked against the database,
        /// so verifying takes effect without signing in again). Returns a 403 result, or null when allowed.
        /// </summary>
        public static async Task<IActionResult?> RequireVerifiedEmailAsync(this PrimeHomesDbContext db, int userId)
        {
            var verified = await db.Users.AnyAsync(u => u.UserId == userId && u.EmailVerified);

            return verified
                ? null
                : new ObjectResult(new { message = "Please verify your email address first. Check your inbox or resend the link from your profile.", code = "email_not_verified" })
                  { StatusCode = StatusCodes.Status403Forbidden };
        }
    }
}
