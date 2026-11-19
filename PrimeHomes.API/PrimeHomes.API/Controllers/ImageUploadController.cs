using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PrimeHomes.API.Services;

namespace PrimeHomes.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Owner")]
    public class ImageUploadController : ControllerBase
    {
        private readonly IWebHostEnvironment _environment;

        public ImageUploadController(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        [HttpPost]
        [RequestSizeLimit(ImageStorage.MaxBytes + 64 * 1024)]
        public async Task<IActionResult> UploadImage(IFormFile file)
        {
            var error = ImageStorage.Validate(file);
            if (error != null)
            {
                return BadRequest(new { message = error });
            }

            var imageUrl = await ImageStorage.SaveAsync(file, _environment.WebRootPath);

            return Ok(new { message = "Image uploaded successfully.", imageUrl });
        }
    }
}
