using System.Diagnostics;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using PrimeHomes.API.Data;

namespace PrimeHomes.API.Services
{
    /// <summary>Ready only when SQL Server answers. Used by /health/ready (load balancer, Docker, Kubernetes).</summary>
    public class DatabaseHealthCheck : IHealthCheck
    {
        private readonly PrimeHomesDbContext _db;

        public DatabaseHealthCheck(PrimeHomesDbContext db) => _db = db;

        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
        {
            try
            {
                return await _db.Database.CanConnectAsync(ct)
                    ? HealthCheckResult.Healthy("Database reachable")
                    : HealthCheckResult.Unhealthy("Database not reachable");
            }
            catch (Exception ex)
            {
                return HealthCheckResult.Unhealthy("Database check failed", ex);
            }
        }
    }

    /// <summary>
    /// One structured log line per request (method, path, status, duration, request id) and an
    /// X-Request-Id response header, so a user's error report can be matched to the server log.
    /// </summary>
    public class RequestLogging
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RequestLogging> _logger;

        public RequestLogging(RequestDelegate next, ILogger<RequestLogging> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var requestId = context.Request.Headers["X-Request-Id"].FirstOrDefault() is { Length: > 0 and <= 64 } incoming
                ? incoming
                : Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;
            context.TraceIdentifier = requestId;
            context.Response.Headers["X-Request-Id"] = requestId;

            var started = Stopwatch.GetTimestamp();
            try
            {
                await _next(context);
            }
            finally
            {
                var elapsedMs = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
                var status = context.Response.StatusCode;
                var path = context.Request.Path.Value ?? "";

                // Health probes and static files are noise at Information level.
                var level = status >= 500 ? LogLevel.Error
                    : path.StartsWith("/health") || path.StartsWith("/uploads") ? LogLevel.Debug
                    : LogLevel.Information;

                _logger.Log(level, "HTTP {Method} {Path} responded {StatusCode} in {ElapsedMs:0} ms (request {RequestId}, user {UserId})",
                    context.Request.Method, path, status, elapsedMs, requestId,
                    context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "-");
            }
        }
    }
}
