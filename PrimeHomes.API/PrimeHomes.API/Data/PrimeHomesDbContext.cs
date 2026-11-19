
using Microsoft.EntityFrameworkCore;
using PrimeHomes.API.Models;

namespace PrimeHomes.API.Data
{
    public class PrimeHomesDbContext : DbContext
    {
        public PrimeHomesDbContext(
            DbContextOptions<PrimeHomesDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; }

        public DbSet<Property> Properties { get; set; }

        public DbSet<ContactRequest> ContactRequests { get; set; }

        public DbSet<PropertyImage> PropertyImages { get; set; }

        public DbSet<Inquiry> Inquiries { get; set; }

        public DbSet<Favorite> Favorites { get; set; }

        public DbSet<PropertyReview> PropertyReviews { get; set; }

        public DbSet<UserProfile> UserProfiles { get; set; }

        public DbSet<Notification> Notifications { get; set; }

        public DbSet<UserToken> UserTokens { get; set; }

        public DbSet<SiteVisit> SiteVisits { get; set; }

        public DbSet<SavedSearch> SavedSearches { get; set; }

        public DbSet<PropertyViewDaily> PropertyViewsDaily { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<PropertyReview>()
                .HasOne(review => review.Property)
                .WithMany()
                .HasForeignKey(review => review.PropertyId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PropertyReview>()
                .HasOne(review => review.User)
                .WithMany()
                .HasForeignKey(review => review.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserToken>(t =>
            {
                t.HasIndex(x => new { x.UserId, x.Purpose });
                t.Property(x => x.TokenHash).HasMaxLength(64); // SHA-256 hex
                t.Property(x => x.Purpose).HasMaxLength(32);
                t.HasIndex(x => x.TokenHash); // refresh lookups
            });

            modelBuilder.Entity<SiteVisit>(visit =>
            {
                visit.HasOne(v => v.Property).WithMany().HasForeignKey(v => v.PropertyId).OnDelete(DeleteBehavior.Cascade);
                visit.HasIndex(v => new { v.Status, v.ScheduledAt });
            });

            modelBuilder.Entity<SavedSearch>().HasIndex(s => s.UserId);
            modelBuilder.Entity<Property>().Property(p => p.ApprovedPrice).HasPrecision(18, 2);

            modelBuilder.Entity<PropertyViewDaily>(v =>
            {
                v.ToTable("PropertyViewsDaily");
                v.HasKey(x => new { x.PropertyId, x.Day });
                v.Property(x => x.Day).HasColumnType("date");
            });

            // Decimal budgets were created without an explicit precision.
            modelBuilder.Entity<UserProfile>().Property(p => p.MinBudget).HasPrecision(18, 2);
            modelBuilder.Entity<UserProfile>().Property(p => p.MaxBudget).HasPrecision(18, 2);
        }
    }
}
