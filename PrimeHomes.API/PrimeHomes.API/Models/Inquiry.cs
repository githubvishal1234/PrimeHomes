namespace PrimeHomes.API.Models
{
    public class Inquiry
    {
        public int InquiryId { get; set; }

        public int PropertyId { get; set; }

        public int BuyerId { get; set; }

        public int OwnerId { get; set; }

        public string Message { get; set; } = string.Empty;

        /// <summary>New → Viewed (owner opened) → Responded → Closed.</summary>
        public string Status { get; set; } = "New";

        public string? OwnerReply { get; set; }

        public DateTime? RespondedDate { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        public Property? Property { get; set; }
    }
}