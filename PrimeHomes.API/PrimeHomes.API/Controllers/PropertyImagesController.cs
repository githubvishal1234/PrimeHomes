using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PrimeHomes.API.Data;
using PrimeHomes.API.Models;
using System.Security.Claims;
using PrimeHomes.API.Services;

namespace PrimeHomes.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PropertyImagesController : ControllerBase
    {
        private readonly PrimeHomesDbContext _context;
        private readonly IWebHostEnvironment _environment;

        public PropertyImagesController(
            PrimeHomesDbContext context,
            IWebHostEnvironment environment)
        {
            _context = context;
            _environment = environment;
        }

        // ============================================
        // UPLOAD MULTIPLE IMAGES FOR A PROPERTY
        // ============================================

        [HttpPost("upload/{propertyId}")]
        [RequestSizeLimit(20 * ImageStorage.MaxBytes)]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> UploadImages(
            int propertyId,
            List<IFormFile> files)
        {
            // Check whether the property exists
            var property = await _context.Properties
                .FirstOrDefaultAsync(p => p.PropertyId == propertyId);

            if (property == null)
            {
                return NotFound("Property not found.");
            }

            var userIdClaim =
    User.FindFirst("UserId")?.Value
    ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
    ?? User.FindFirst("sub")?.Value;

            if (string.IsNullOrEmpty(userIdClaim))
            {
                return Unauthorized("User ID not found in token.");
            }

            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized("Invalid User ID.");
            }
            // Check whether the logged-in owner owns this property
            if (property.OwnerId != userId)
            {
                return Forbid();
            }

            // Validate every file before saving any, so a bad file doesn't leave partial uploads
            if (files == null || files.Count == 0)
            {
                return BadRequest(new { message = "Please select at least one image." });
            }

            if (files.Count > 20)
            {
                return BadRequest(new { message = "You can upload up to 20 images at a time." });
            }

            foreach (var file in files)
            {
                var error = ImageStorage.Validate(file);
                if (error != null)
                {
                    return BadRequest(new { message = $"{file?.FileName}: {error}" });
                }
            }

            var uploadedImages = new List<PropertyImage>();

            foreach (var file in files)
            {
                var propertyImage = new PropertyImage
                {
                    PropertyId = propertyId,
                    ImageUrl = await ImageStorage.SaveAsync(file, _environment.WebRootPath),
                    CreatedDate = DateTime.UtcNow
                };

                _context.PropertyImages.Add(propertyImage);

                uploadedImages.Add(propertyImage);
            }

            // Check whether any valid images were uploaded
            if (uploadedImages.Count == 0)
            {
                return BadRequest("No valid images were uploaded.");
            }

            // Save image records to database
            await _context.SaveChangesAsync();

            // Return response
            return Ok(new
            {
                message = "Images uploaded successfully.",

                images = uploadedImages.Select(x => new
                {
                    x.PropertyImageId,
                    x.PropertyId,
                    x.ImageUrl,
                    x.CreatedDate
                })
            });
        }


        // ============================================
        // GET ALL IMAGES FOR A PROPERTY
        // ============================================

        [HttpGet("{propertyId}")]
        public async Task<IActionResult> GetPropertyImages(
            int propertyId)
        {
            var images = await _context.PropertyImages
                .Where(x => x.PropertyId == propertyId)
                .OrderBy(x => x.CreatedDate)
                .ToListAsync();

            return Ok(images);
        }





        // ============================================
        // DELETE PROPERTY IMAGE
        // ============================================

        [HttpDelete("{imageId}")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> DeletePropertyImage(int imageId)
        {
            // Find image record
            var propertyImage = await _context.PropertyImages
                .FirstOrDefaultAsync(x => x.PropertyImageId == imageId);

            if (propertyImage == null)
            {
                return NotFound(new
                {
                    message = "Property image not found."
                });
            }

            // Find the property
            var property = await _context.Properties
                .FirstOrDefaultAsync(x => x.PropertyId == propertyImage.PropertyId);

            if (property == null)
            {
                return NotFound(new
                {
                    message = "Property not found."
                });
            }

            // Get logged-in user ID
            var userIdClaim =
                User.FindFirst("UserId")?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (string.IsNullOrEmpty(userIdClaim))
            {
                return Unauthorized(new
                {
                    message = "User ID not found in token."
                });
            }

            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new
                {
                    message = "Invalid User ID."
                });
            }

            // Check whether the logged-in owner owns the property
            if (property.OwnerId != userId)
            {
                return Forbid();
            }

            ImageStorage.Delete(propertyImage.ImageUrl, _environment.WebRootPath);

            // Delete database record
            _context.PropertyImages.Remove(propertyImage);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Property image deleted successfully."
            });
        }
    }
}