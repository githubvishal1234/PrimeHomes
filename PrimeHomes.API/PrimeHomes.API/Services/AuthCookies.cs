namespace PrimeHomes.API.Services
{
    /// <summary>
    /// Session cookies. Both are HttpOnly (page scripts can't read them, so an XSS bug can't steal a session),
    /// Secure, and SameSite=Strict (never sent on cross-site requests, which blocks CSRF).
    /// The refresh cookie is only sent to /api/Auth.
    /// </summary>
    public static class AuthCookies
    {
        public const string Access = "ph_access";
        public const string Refresh = "ph_refresh";

        public static readonly TimeSpan AccessLifetime = TimeSpan.FromMinutes(15);
        public static readonly TimeSpan RefreshLifetime = TimeSpan.FromDays(14);

        public static void Set(HttpResponse response, string accessToken, string refreshToken)
        {
            response.Cookies.Append(Access, accessToken, Options("/", AccessLifetime));
            response.Cookies.Append(Refresh, refreshToken, Options("/api/Auth", RefreshLifetime));
        }

        public static void Clear(HttpResponse response)
        {
            response.Cookies.Delete(Access, Options("/", TimeSpan.Zero));
            response.Cookies.Delete(Refresh, Options("/api/Auth", TimeSpan.Zero));
        }

        private static CookieOptions Options(string path, TimeSpan lifetime) => new()
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = path,
            MaxAge = lifetime,
            IsEssential = true
        };
    }
}
