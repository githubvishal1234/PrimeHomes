using Microsoft.EntityFrameworkCore;
using PrimeHomes.API.Data;
using PrimeHomes.API.Models;

namespace PrimeHomes.API.Services
{
    /// <summary>
    /// One place for "tell a user something happened": stores the in-app notification and,
    /// when asked, emails the same message. Call after the caller's own SaveChanges.
    /// </summary>
    public class Notifier
    {
        private readonly PrimeHomesDbContext _db;
        private readonly EmailSender _email;

        public Notifier(PrimeHomesDbContext db, EmailSender email)
        {
            _db = db;
            _email = email;
        }

        public Task NotifyAsync(int userId, string title, string message, string type, int? propertyId = null, bool email = false) =>
            NotifyManyAsync([userId], title, message, type, propertyId, email);

        public async Task NotifyRoleAsync(string role, string title, string message, string type, int? propertyId = null, bool email = false)
        {
            var ids = await _db.Users.Where(u => u.Role == role).Select(u => u.UserId).ToListAsync();
            await NotifyManyAsync(ids, title, message, type, propertyId, email);
        }

        private async Task NotifyManyAsync(IReadOnlyCollection<int> userIds, string title, string message, string type, int? propertyId, bool email)
        {
            foreach (var userId in userIds)
            {
                _db.Notifications.Add(new Notification
                {
                    UserId = userId,
                    Title = title,
                    Message = message,
                    Type = type,
                    RelatedPropertyId = propertyId,
                    CreatedDate = DateTime.UtcNow
                });
            }

            await _db.SaveChangesAsync();

            if (!email)
                return;

            var recipients = await _db.Users.Where(u => userIds.Contains(u.UserId)).Select(u => u.Email).ToListAsync();
            var link = propertyId is { } id ? $"\n\nView: {_email.Link($"/properties/{id}")}" : "";

            foreach (var to in recipients)
            {
                await _email.SendAsync(to, $"PrimeHomes: {title}", message + link);
            }
        }
    }
}
