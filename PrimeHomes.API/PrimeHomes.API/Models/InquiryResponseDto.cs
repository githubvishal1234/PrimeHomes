namespace PrimeHomes.API.Models
{
    public class InquiryResponseDto
    {
        public int InquiryId { get; set; }

        public int PropertyId { get; set; }

        public string PropertyTitle { get; set; } = string.Empty;

        public int BuyerId { get; set; }

        public int OwnerId { get; set; }

        public string Message { get; set; } = string.Empty;

        public string Status { get; set; } = string.Empty;

        public DateTime CreatedDate { get; set; }

        public string? OwnerReply { get; set; }

        public DateTime? RespondedDate { get; set; }

        public string? BuyerName { get; set; }
    }
}