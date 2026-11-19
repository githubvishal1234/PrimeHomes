using System.Security.Cryptography;
using System.Text;

namespace PrimeHomes.API.Models
{
    /// <summary>One-time token for email verification or password reset. Only a SHA-256 hash is stored.</summary>
    public class UserToken
    {
        public const string VerifyEmail = "verify-email";
        public const string ResetPassword = "reset-password";
        public const string Refresh = "refresh";

        public int UserTokenId { get; set; }

        public int UserId { get; set; }

        public string Purpose { get; set; } = string.Empty;

        public string TokenHash { get; set; } = string.Empty;

        public DateTime ExpiresAt { get; set; }

        public DateTime? UsedAt { get; set; }

        public static string NewToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

        public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    }
}
