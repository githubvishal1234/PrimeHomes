using Microsoft.EntityFrameworkCore;
using PrimeHomes.API.Data;
using PrimeHomes.API.Models;

namespace PrimeHomes.API.Services
{
    /// <summary>
    /// Hourly housekeeping: expires live listings with no update for 90 days, and reminds both
    /// sides of confirmed site visits happening in the next 24 hours.
    /// </summary>
    public class MaintenanceService : BackgroundService
    {
        private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<MaintenanceService> _logger;

        public MaintenanceService(IServiceScopeFactory scopes, ILogger<MaintenanceService> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(Interval);

            do
            {
                try
                {
                    var expired = await ExpireStaleListingsAsync(stoppingToken);
                    var reminded = await SendVisitRemindersAsync(stoppingToken);
                    await PurgeOldTokensAsync(stoppingToken);
                    if (expired + reminded > 0)
                        _logger.LogInformation("Maintenance: expired {Expired} listings, sent {Reminded} visit reminders", expired, reminded);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError(ex, "Maintenance run failed; will retry next interval");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }

        private async Task<int> ExpireStaleListingsAsync(CancellationToken ct)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PrimeHomesDbContext>();

            var cutoff = DateTime.UtcNow - PropertyStatus.ExpiresAfter;

            var stale = await db.Properties
                .Where(p => p.Status == PropertyStatus.Approved
                    && (p.UpdatedDate ?? p.ApprovedDate ?? p.CreatedDate) < cutoff)
                .ToListAsync(ct);

            foreach (var p in stale)
            {
                p.Status = PropertyStatus.Expired;
                db.Notifications.Add(new Notification
                {
                    UserId = p.OwnerId,
                    Title = "Listing expired",
                    Message = $"'{p.Title}' was hidden from search after 90 days without updates. Renew it to make it live again.",
                    Type = "PropertyExpired",
                    RelatedPropertyId = p.PropertyId,
                    CreatedDate = DateTime.UtcNow
                });
            }

            await db.SaveChangesAsync(ct);
            return stale.Count;
        }
    
        private async Task<int> SendVisitRemindersAsync(CancellationToken ct)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PrimeHomesDbContext>();
            var notifier = scope.ServiceProvider.GetRequiredService<Notifier>();

            var now = DateTime.UtcNow;
            var due = await db.SiteVisits
                .Include(v => v.Property)
                .Where(v => v.Status == SiteVisit.Accepted && !v.ReminderSent && v.ScheduledAt > now && v.ScheduledAt <= now.AddHours(24))
                .ToListAsync(ct);

            foreach (var visit in due)
            {
                visit.ReminderSent = true;
                await db.SaveChangesAsync(ct);

                var when = (visit.ScheduledAt + SiteVisit.IndiaOffset).ToString("ddd d MMM, h:mm tt") + " IST";
                foreach (var userId in new[] { visit.BuyerId, visit.OwnerId })
                {
                    await notifier.NotifyAsync(userId, "Site visit tomorrow",
                        $"Reminder: visit to '{visit.Property?.Title}' on {when}.",
                        "SiteVisitReminder", visit.PropertyId, email: true);
                }
            }

            return due.Count;
        }

        /// <summary>Deletes used or expired one-time and refresh tokens older than 30 days.</summary>
        private async Task PurgeOldTokensAsync(CancellationToken ct)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PrimeHomesDbContext>();
            var cutoff = DateTime.UtcNow.AddDays(-30);
            await db.UserTokens.Where(t => t.ExpiresAt < cutoff || t.UsedAt < cutoff).ExecuteDeleteAsync(ct);
        }
    }
}
