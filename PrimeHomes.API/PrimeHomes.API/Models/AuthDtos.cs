using System.ComponentModel.DataAnnotations;

namespace PrimeHomes.API.Models
{
    public class RegisterRequest
    {
        [Required, StringLength(100, MinimumLength = 2)]
        public string Name { get; set; } = string.Empty;

        [Required, EmailAddress, StringLength(150)]
        public string Email { get; set; } = string.Empty;

        [Phone, StringLength(20)]
        public string? Phone { get; set; }

        [Required, StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be at least 8 characters.")]
        public string Password { get; set; } = string.Empty;

        // Admins are never created through public registration.
        [Required, RegularExpression("^(Buyer|Owner)$", ErrorMessage = "Role must be Buyer or Owner.")]
        public string Role { get; set; } = "Buyer";
    }

    public class LoginRequest
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }
}
