using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PrimeHomes.API.Data;
using PrimeHomes.API.Models;
using PrimeHomes.API.Services;
using Microsoft.AspNetCore.Authorization;

namespace PrimeHomes.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [EnableRateLimiting("auth")]
    public class AuthController : ControllerBase
    {
        private readonly PrimeHomesDbContext _context;
        private readonly SymmetricSecurityKey _jwtSigningKey;
        private readonly IPasswordHasher<User> _hasher;
        private readonly IConfiguration _config;
        private readonly EmailSender _email;

        public AuthController(
            PrimeHomesDbContext context,
            SymmetricSecurityKey jwtSigningKey,
            IPasswordHasher<User> hasher,
            IConfiguration config,
            EmailSender email)
        {
            _context = context;
            _jwtSigningKey = jwtSigningKey;
            _hasher = hasher;
            _config = config;
            _email = email;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterRequest request)
        {
            var email = request.Email.Trim().ToLowerInvariant();

            if (await _context.Users.AnyAsync(u => u.Email == email))
            {
                return Conflict(new { message = "This email is already registered." });
            }

            var user = new User
            {
                Name = request.Name.Trim(),
                Email = email,
                Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
                Role = request.Role,
                CreatedDate = DateTime.UtcNow
            };
            user.Password = _hasher.HashPassword(user, request.Password);

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            await SendVerificationEmailAsync(user);

            return Ok(new { user.UserId, user.Name, user.Email, user.Phone, user.Role, user.EmailVerified });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginRequest request)
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

            if (user == null || !VerifyAndUpgrade(user, request.Password))
            {
                return Unauthorized(new { message = "Invalid email or password." });
            }

            await _context.SaveChangesAsync(); // persists a hash upgrade, if any

            await StartSessionAsync(user);

            return Ok(UserInfo(user));
        }

        // POST: api/Auth/refresh — swaps a valid refresh cookie for a new access + refresh pair (rotation)
        [HttpPost("refresh")]
        [DisableRateLimiting]
        public async Task<IActionResult> Refresh()
        {
            if (!Request.Cookies.TryGetValue(AuthCookies.Refresh, out var refreshToken) || string.IsNullOrWhiteSpace(refreshToken))
                return Unauthorized(new { message = "Please sign in." });

            var hash = UserToken.Hash(refreshToken);
            var stored = await _context.UserTokens.FirstOrDefaultAsync(t => t.Purpose == UserToken.Refresh && t.TokenHash == hash);

            if (stored == null || stored.ExpiresAt <= DateTime.UtcNow)
            {
                AuthCookies.Clear(Response);
                return Unauthorized(new { message = "Your session has expired. Please sign in again." });
            }

            if (stored.UsedAt != null)
            {
                // A refresh token was used twice: someone may have copied it. End every session for this user.
                await RevokeRefreshTokensAsync(stored.UserId);
                AuthCookies.Clear(Response);
                return Unauthorized(new { message = "For your security, please sign in again." });
            }

            stored.UsedAt = DateTime.UtcNow;
            var user = await _context.Users.FirstAsync(u => u.UserId == stored.UserId);
            await StartSessionAsync(user);

            return Ok(UserInfo(user));
        }

        // POST: api/Auth/logout — revokes the refresh token and clears the cookies
        [HttpPost("logout")]
        [DisableRateLimiting]
        public async Task<IActionResult> Logout()
        {
            if (Request.Cookies.TryGetValue(AuthCookies.Refresh, out var refreshToken) && !string.IsNullOrWhiteSpace(refreshToken))
            {
                var hash = UserToken.Hash(refreshToken);
                await _context.UserTokens
                    .Where(t => t.Purpose == UserToken.Refresh && t.TokenHash == hash && t.UsedAt == null)
                    .ExecuteUpdateAsync(x => x.SetProperty(t => t.UsedAt, DateTime.UtcNow));
            }

            AuthCookies.Clear(Response);
            return Ok(new { message = "Signed out." });
        }

        private static object UserInfo(User user) =>
            new { user.UserId, user.Name, user.Email, user.Phone, user.Role, user.EmailVerified };

        /// <summary>Issues a 15-minute access token and a rotating 14-day refresh token, both as HttpOnly cookies.</summary>
        private async Task StartSessionAsync(User user)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                new Claim(ClaimTypes.Name, user.Name),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role)
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.Add(AuthCookies.AccessLifetime),
                signingCredentials: new SigningCredentials(_jwtSigningKey, SecurityAlgorithms.HmacSha256));

            var refreshToken = UserToken.NewToken();
            _context.UserTokens.Add(new UserToken
            {
                UserId = user.UserId,
                Purpose = UserToken.Refresh,
                TokenHash = UserToken.Hash(refreshToken),
                ExpiresAt = DateTime.UtcNow.Add(AuthCookies.RefreshLifetime)
            });
            await _context.SaveChangesAsync();

            AuthCookies.Set(Response, new JwtSecurityTokenHandler().WriteToken(token), refreshToken);
        }

        private Task RevokeRefreshTokensAsync(int userId) =>
            _context.UserTokens
                .Where(t => t.UserId == userId && t.Purpose == UserToken.Refresh && t.UsedAt == null)
                .ExecuteUpdateAsync(x => x.SetProperty(t => t.UsedAt, DateTime.UtcNow));

        // POST: api/Auth/forgot-password — always 200, so the response never reveals which emails exist.
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

            if (user != null)
            {
                var token = await IssueTokenAsync(user.UserId, UserToken.ResetPassword, TimeSpan.FromMinutes(30));
                var link = _email.Link($"/reset-password?email={Uri.EscapeDataString(user.Email)}&token={token}");

                await _email.SendAsync(user.Email, "Reset your PrimeHomes password",
                    $"Hi {user.Name},\n\nUse this link within 30 minutes to choose a new password:\n{link}\n\nIf you did not ask for this, ignore this email.");
            }

            return Ok(new { message = "If an account exists for that email, a reset link has been sent." });
        }

        // POST: api/Auth/reset-password
        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
        {
            var user = await ConsumeTokenAsync(request.Email, request.Token, UserToken.ResetPassword);

            if (user == null)
                return BadRequest(new { message = "This reset link is invalid or has expired. Request a new one." });

            user.Password = _hasher.HashPassword(user, request.NewPassword);
            user.EmailVerified = true; // the user just proved they own the inbox
            await _context.SaveChangesAsync();
            await RevokeRefreshTokensAsync(user.UserId); // sign out everywhere after a reset

            return Ok(new { message = "Password updated. You can sign in now." });
        }

        // POST: api/Auth/verify-email
        [HttpPost("verify-email")]
        public async Task<IActionResult> VerifyEmail(VerifyEmailRequest request)
        {
            var user = await ConsumeTokenAsync(request.Email, request.Token, UserToken.VerifyEmail);

            if (user == null)
                return BadRequest(new { message = "This verification link is invalid or has expired. Sign in and request a new one." });

            user.EmailVerified = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Email verified. Thank you!" });
        }

        // POST: api/Auth/resend-verification
        [Authorize]
        [HttpPost("resend-verification")]
        public async Task<IActionResult> ResendVerification()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FirstAsync(u => u.UserId == userId);

            if (user.EmailVerified)
                return Ok(new { message = "Your email is already verified.", emailVerified = true });

            await SendVerificationEmailAsync(user);

            return Ok(new { message = $"Verification email sent to {user.Email}.", emailVerified = false });
        }

        private async Task SendVerificationEmailAsync(User user)
        {
            var token = await IssueTokenAsync(user.UserId, UserToken.VerifyEmail, TimeSpan.FromDays(2));
            var link = _email.Link($"/verify-email?email={Uri.EscapeDataString(user.Email)}&token={token}");

            await _email.SendAsync(user.Email, "Verify your PrimeHomes email",
                $"Hi {user.Name},\n\nConfirm your email address to contact owners and post properties:\n{link}");
        }

        /// <summary>Creates a fresh token and invalidates older unused ones for the same purpose.</summary>
        private async Task<string> IssueTokenAsync(int userId, string purpose, TimeSpan lifetime)
        {
            await _context.UserTokens
                .Where(t => t.UserId == userId && t.Purpose == purpose && t.UsedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, DateTime.UtcNow));

            var token = UserToken.NewToken();
            _context.UserTokens.Add(new UserToken
            {
                UserId = userId,
                Purpose = purpose,
                TokenHash = UserToken.Hash(token),
                ExpiresAt = DateTime.UtcNow.Add(lifetime)
            });
            await _context.SaveChangesAsync();

            return token;
        }

        /// <summary>Returns the user if the token is valid, unused and unexpired, and marks it used.</summary>
        private async Task<User?> ConsumeTokenAsync(string email, string token, string purpose)
        {
            var normalized = email.Trim().ToLowerInvariant();
            var hash = UserToken.Hash(token.Trim());

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalized);
            if (user == null)
                return null;

            var match = await _context.UserTokens.FirstOrDefaultAsync(t =>
                t.UserId == user.UserId
                && t.Purpose == purpose
                && t.TokenHash == hash
                && t.UsedAt == null
                && t.ExpiresAt > DateTime.UtcNow);

            if (match == null)
                return null;

            match.UsedAt = DateTime.UtcNow;
            return user;
        }

        /// <summary>
        /// Verifies the password. Accounts created before hashing still hold plain text;
        /// those are compared once and re-hashed on successful login.
        /// </summary>
        private bool VerifyAndUpgrade(User user, string password)
        {
            if (IsIdentityV3Hash(user.Password))
            {
                var result = _hasher.VerifyHashedPassword(user, user.Password, password);
                if (result == PasswordVerificationResult.SuccessRehashNeeded)
                {
                    user.Password = _hasher.HashPassword(user, password);
                }
                return result != PasswordVerificationResult.Failed;
            }

            var legacyMatch = CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(user.Password),
                Encoding.UTF8.GetBytes(password));

            if (legacyMatch)
            {
                user.Password = _hasher.HashPassword(user, password);
            }
            return legacyMatch;
        }

        // ASP.NET Identity v3 hashes are base64, start with 0x01 and are at least 61 bytes.
        private static bool IsIdentityV3Hash(string stored)
        {
            var buffer = new byte[stored.Length];
            return Convert.TryFromBase64String(stored, buffer, out var length)
                && length >= 61
                && buffer[0] == 0x01;
        }
    }
}
