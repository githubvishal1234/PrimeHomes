using System.Security.Claims;
using PrimeHomes.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PrimeHomes.API.Data;
using PrimeHomes.API.Models;

namespace PrimeHomes.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UserProfilesController : ControllerBase
    {
        private readonly PrimeHomesDbContext _context;
        private readonly IWebHostEnvironment _environment;

        public UserProfilesController(
            PrimeHomesDbContext context,
            IWebHostEnvironment environment)
        {
            _context = context;
            _environment = environment;
        }


        // ============================================
        // GET MY PROFILE
        // GET: api/UserProfiles/me
        // ============================================

        [HttpGet("me")]
        public async Task<IActionResult> GetMyProfile()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

            if (userIdClaim == null)
            {
                return Unauthorized(new
                {
                    message = "User ID not found."
                });
            }

            var userId = int.Parse(userIdClaim.Value);

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.UserId == userId);

            if (user == null)
            {
                return NotFound(new
                {
                    message = "User not found."
                });
            }

            var profile = await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == userId);

            return Ok(new
            {
                user.UserId,
                user.Name,
                user.Email,
                user.Phone,
                user.Role,

                Profile = profile
            });
        }


        // ============================================
        // CREATE PROFILE
        // POST: api/UserProfiles
        // ============================================

        [HttpPost]
        public async Task<IActionResult> CreateProfile(
            UserProfile profile)
        {
            var userIdClaim = User.FindFirst(
                ClaimTypes.NameIdentifier);

            if (userIdClaim == null)
            {
                return Unauthorized(new
                {
                    message = "User ID not found."
                });
            }

            var userId = int.Parse(userIdClaim.Value);

            var existingProfile = await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (existingProfile != null)
            {
                return BadRequest(new
                {
                    message =
                        "Profile already exists. Please update your existing profile."
                });
            }

            profile.UserId = userId;
            profile.User = null;
            profile.UpdatedDate = DateTime.UtcNow;

            _context.UserProfiles.Add(profile);

            await _context.SaveChangesAsync();

            return Ok(profile);
        }


        // ============================================
        // UPDATE PROFILE
        // PUT: api/UserProfiles
        // ============================================

        [HttpPut]
        public async Task<IActionResult> UpdateProfile(
            UserProfile profile)
        {
            var userIdClaim = User.FindFirst(
                ClaimTypes.NameIdentifier);

            if (userIdClaim == null)
            {
                return Unauthorized(new
                {
                    message = "User ID not found."
                });
            }

            var userId = int.Parse(userIdClaim.Value);

            var existingProfile = await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == userId);

            // If profile does not exist, create it
            if (existingProfile == null)
            {
                profile.UserId = userId;
                profile.User = null;
                profile.UpdatedDate = DateTime.UtcNow;

                _context.UserProfiles.Add(profile);

                await _context.SaveChangesAsync();

                return Ok(profile);
            }

            // Update existing profile
            existingProfile.ProfileImageUrl =
                profile.ProfileImageUrl;

            existingProfile.City =
                profile.City;

            existingProfile.State =
                profile.State;

            existingProfile.Bio =
                profile.Bio;

            existingProfile.CompanyName =
                profile.CompanyName;

            existingProfile.PreferredCity =
                profile.PreferredCity;

            existingProfile.PreferredPropertyType =
                profile.PreferredPropertyType;

            existingProfile.PreferredBHK =
                profile.PreferredBHK;

            existingProfile.MinBudget =
                profile.MinBudget;

            existingProfile.MaxBudget =
                profile.MaxBudget;

            existingProfile.UpdatedDate =
                DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(existingProfile);
        }


        // ============================================
        // UPLOAD PROFILE IMAGE
        // POST: api/UserProfiles/upload-image
        // ============================================

        [HttpPost("upload-image")]
        public async Task<IActionResult> UploadProfileImage(
            IFormFile file)
        {
            var userIdClaim = User.FindFirst(
                ClaimTypes.NameIdentifier);

            if (userIdClaim == null)
            {
                return Unauthorized(new
                {
                    message = "User ID not found."
                });
            }

            var userId = int.Parse(userIdClaim.Value);

            var profile = await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (profile == null)
            {
                return NotFound(new
                {
                    message =
                        "User profile not found. Please save your profile first."
                });
            }

            var error = ImageStorage.Validate(file);
            if (error != null)
            {
                return BadRequest(new { message = error });
            }

            var previousImageUrl = profile.ProfileImageUrl;
            string imageUrl = await ImageStorage.SaveAsync(file, _environment.WebRootPath);

            // ============================================
            // SAVE URL TO PROFILE
            // ============================================

            profile.ProfileImageUrl = imageUrl;
            profile.UpdatedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            ImageStorage.Delete(previousImageUrl, _environment.WebRootPath);

            return Ok(new
            {
                message =
                    "Profile image uploaded successfully.",

                imageUrl =
                    profile.ProfileImageUrl
            });
        }
    }
}