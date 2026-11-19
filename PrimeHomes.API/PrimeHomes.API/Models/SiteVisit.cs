using System.ComponentModel.DataAnnotations;

namespace PrimeHomes.API.Models
{
    /// <summary>
    /// Buyer asks to see a property at a time slot.
    ///   Requested ─accept─▶ Accepted ─complete─▶ Completed
    ///       │                  ▲
    ///       └─reschedule─▶ Rescheduled (owner proposes a new time; buyer accepts)
    /// Either side can cancel before completion.
    /// </summary>
    public class SiteVisit
    {
        public const string Requested = "Requested";
        public const string Rescheduled = "Rescheduled";
        public const string Accepted = "Accepted";
        public const string Completed = "Completed";
        public const string Cancelled = "Cancelled";

        /// <summary>Visits are offered on the hour, 9:00–18:00 IST (03:30–12:30 UTC).</summary>
        public static readonly TimeSpan IndiaOffset = TimeSpan.FromHours(5.5);
        public const int FirstSlotHour = 9;
        public const int LastSlotHour = 18;

        public int SiteVisitId { get; set; }

        public int PropertyId { get; set; }

        public Property? Property { get; set; }

        public int BuyerId { get; set; }

        public int OwnerId { get; set; }

        /// <summary>UTC.</summary>
        public DateTime ScheduledAt { get; set; }

        public string Status { get; set; } = Requested;

        [MaxLength(500)]
        public string? Note { get; set; }

        public bool ReminderSent { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedDate { get; set; }

        public static bool IsActive(string status) => status is Requested or Rescheduled or Accepted;

        /// <summary>Returns an error, or null if the slot is bookable: future, within 60 days, on the hour inside visiting hours (IST).</summary>
        public static string? ValidateSlot(DateTime scheduledAtUtc, DateTime nowUtc)
        {
            var local = scheduledAtUtc + IndiaOffset;

            if (scheduledAtUtc <= nowUtc.AddHours(2))
                return "Pick a time at least 2 hours from now.";

            if (scheduledAtUtc > nowUtc.AddDays(60))
                return "Visits can be booked up to 60 days ahead.";

            if (local.Minute != 0 || local.Second != 0 || local.Hour < FirstSlotHour || local.Hour > LastSlotHour)
                return $"Pick an hourly slot between {FirstSlotHour}:00 and {LastSlotHour}:00.";

            return null;
        }
    }
}
