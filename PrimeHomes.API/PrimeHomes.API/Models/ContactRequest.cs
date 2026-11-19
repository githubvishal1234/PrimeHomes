namespace PrimeHomes.API.Models
{
    public class ContactRequest
    {
        public int ContactRequestId { get; set; }

        // If the user is logged in, we can store their UserId.
        // Guest users will have null.
        public int? UserId { get; set; }

        // Later we can connect the request to a specific property.
        // For a general callback request this will be null.
        public int? PropertyId { get; set; }

        [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(100, MinimumLength = 2)]
        public string FullName { get; set; } = string.Empty;

        [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.EmailAddress, System.ComponentModel.DataAnnotations.StringLength(150)]
        public string Email { get; set; } = string.Empty;

        [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(20, MinimumLength = 7)]
        public string PhoneNumber { get; set; } = string.Empty;

        [System.ComponentModel.DataAnnotations.StringLength(50)]
        public string InterestedIn { get; set; } = string.Empty;

        [System.ComponentModel.DataAnnotations.StringLength(1000)]
        public string Message { get; set; } = string.Empty;

        // New / Contacted / Closed
        public string Status { get; set; } = "New";

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}