namespace PrimeHomes.API.Services
{
    /// <summary>Validates and stores uploaded images under wwwroot/uploads. Returns site-relative URLs.</summary>
    public static class ImageStorage
    {
        public const long MaxBytes = 5 * 1024 * 1024;

        private static readonly HashSet<string> AllowedExtensions =
            new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp", ".avif" };

        /// <summary>Returns an error message, or null when the file is an acceptable image.</summary>
        public static string? Validate(IFormFile? file)
        {
            if (file == null || file.Length == 0)
                return "Please select an image.";

            if (file.Length > MaxBytes)
                return "Each image must be smaller than 5 MB.";

            if (!AllowedExtensions.Contains(Path.GetExtension(file.FileName)))
                return "Only JPG, PNG, WEBP and AVIF images are allowed.";

            Span<byte> head = stackalloc byte[12];
            using var stream = file.OpenReadStream();
            var read = stream.ReadAtLeast(head, head.Length, throwOnEndOfStream: false);

            return HasImageSignature(head[..read]) ? null : "The file is not a valid image.";
        }

        public static async Task<string> SaveAsync(IFormFile file, string webRootPath)
        {
            var folder = Path.Combine(webRootPath, "uploads");
            Directory.CreateDirectory(folder);

            var fileName = Guid.NewGuid() + Path.GetExtension(file.FileName).ToLowerInvariant();

            await using var output = new FileStream(Path.Combine(folder, fileName), FileMode.CreateNew);
            await file.CopyToAsync(output);

            return $"/uploads/{fileName}";
        }

        /// <summary>Deletes a stored upload. Accepts relative or legacy absolute URLs; ignores anything outside uploads.</summary>
        public static void Delete(string? imageUrl, string webRootPath)
        {
            if (string.IsNullOrWhiteSpace(imageUrl))
                return;

            var fileName = Path.GetFileName(imageUrl.Split('?')[0]);

            // Only files this app stored (GUID names) are deleted; seed and legacy images may be shared.
            if (!Guid.TryParse(Path.GetFileNameWithoutExtension(fileName), out _))
                return;

            var path = Path.Combine(webRootPath, "uploads", fileName);

            if (File.Exists(path))
                File.Delete(path);
        }

        private static bool HasImageSignature(ReadOnlySpan<byte> h) =>
            (h.Length >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF)                       // JPEG
            || (h.Length >= 4 && h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47)     // PNG
            || (h.Length >= 12 && h[..4].SequenceEqual("RIFF"u8) && h[8..12].SequenceEqual("WEBP"u8)) // WEBP
            || (h.Length >= 12 && h[4..8].SequenceEqual("ftyp"u8));                                // AVIF/HEIF
    }
}
