namespace PrimeHomes.API.Models
{
    /// <summary>
    /// Property lifecycle. "Approved" is the live state shown to buyers.
    ///
    ///   Draft ──submit──▶ Pending ──approve──▶ Approved ──mark──▶ Sold / Rented
    ///                        │  ▲                 │  │
    ///                 reject ▼  │ resubmit/edit   │  └─ 90 days without update ─▶ Expired ──renew──▶ Pending
    ///                     Rejected ◀── takedown ──┘
    /// </summary>
    public static class PropertyStatus
    {
        public const string Draft = "Draft";
        public const string Pending = "Pending";
        public const string Approved = "Approved";
        public const string Rejected = "Rejected";
        public const string Sold = "Sold";
        public const string Rented = "Rented";
        public const string Expired = "Expired";

        public static readonly TimeSpan ExpiresAfter = TimeSpan.FromDays(90);

        /// <summary>Owner sends a listing for review (from Draft, Rejected or Expired).</summary>
        public static bool CanSubmit(string from) => from is Draft or Rejected or Expired;

        public static bool CanApprove(string from) => from == Pending;

        /// <summary>Admin rejects a pending listing or takes down a live one.</summary>
        public static bool CanReject(string from) => from is Pending or Approved;

        /// <summary>Owner closes a live listing. Rentals can only be Rented, sales only Sold.</summary>
        public static bool CanClose(string from, string to, string listingType) =>
            from == Approved && (to == Sold && listingType == "Sale" || to == Rented && listingType == "Rent");

        /// <summary>Owner edits are allowed until the listing is closed.</summary>
        public static bool CanEdit(string from) => from is not (Sold or Rented);

        /// <summary>
        /// Status after an owner edit: drafts stay drafts, everything else goes back to review,
        /// so buyers never see unreviewed content.
        /// </summary>
        public static string AfterEdit(string from) => from == Draft ? Draft : Pending;
    }
}
