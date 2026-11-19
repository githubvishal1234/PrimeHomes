using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PrimeHomes.API.Data;
using PrimeHomes.API.Models;
using PrimeHomes.API.Services;

var builder = WebApplication.CreateBuilder(args);

// Production logs are one JSON object per line, ready for any log collector.
if (!builder.Environment.IsDevelopment())
{
    builder.Logging.ClearProviders();
    builder.Logging.AddJsonConsole(o => o.IncludeScopes = true);
}

builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new UtcDateTimeConverter()));
builder.Services.AddProblemDetails();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy => policy
        .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:4200"])
        .AllowAnyHeader()
        .AllowAnyMethod());
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    var scheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter JWT token",
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
    };
    options.AddSecurityDefinition("Bearer", scheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement { { scheme, Array.Empty<string>() } });
});

builder.Services.AddDbContext<PrimeHomesDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<EmailSender>();
builder.Services.AddScoped<Notifier>();
builder.Services.AddScoped<ListingAlerts>();
builder.Services.AddHostedService<MaintenanceService>();

// ==========================================
// JWT — the signing key comes from user-secrets (dev) or environment (prod), never appsettings.json
// ==========================================

var jwtSigningKeyValue = builder.Configuration["Jwt:SigningKey"];
if (string.IsNullOrWhiteSpace(jwtSigningKeyValue) || Encoding.UTF8.GetByteCount(jwtSigningKeyValue) < 32)
{
    throw new InvalidOperationException(
        "Jwt:SigningKey must be set (at least 32 bytes). Development: " +
        "dotnet user-secrets set \"Jwt:SigningKey\" \"<random-secret>\". Production: environment variable Jwt__SigningKey.");
}

var jwtSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKeyValue));
builder.Services.AddSingleton(jwtSigningKey);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = jwtSigningKey
        };

        // Browsers send the token in an HttpOnly cookie (scripts can't read it);
        // API clients and Swagger may still send "Authorization: Bearer".
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (string.IsNullOrEmpty(context.Token) && context.Request.Cookies.TryGetValue(AuthCookies.Access, out var token))
                {
                    context.Token = token;
                }
                return Task.CompletedTask;
            }
        };
    });

// ==========================================
// Rate limiting — slows password guessing on /api/Auth
// ==========================================

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
});

var app = builder.Build();

// Behind nginx / a load balancer: trust X-Forwarded-For/Proto so HTTPS and client IPs are seen correctly.
var forwarded = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto };
if (app.Configuration.GetValue<bool>("Proxy:TrustAll"))
{
    // Only when the API is reachable solely through the proxy (e.g. the docker-compose network).
    forwarded.KnownNetworks.Clear();
    forwarded.KnownProxies.Clear();
}
app.UseForwardedHeaders(forwarded);

if (app.Environment.IsDevelopment())
{
    await DevSeeder.RunAsync(app.Services);
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    // Containers set Database__MigrateOnStartup=true; elsewhere run migrations as a deploy step.
    if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
    {
        using var scope = app.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<PrimeHomesDbContext>().Database.MigrateAsync();
    }

    app.UseExceptionHandler();
    app.UseHsts();
}

app.UseMiddleware<RequestLogging>();
app.UseStatusCodePages();

// Uploaded files are served as their declared image type only, never sniffed as HTML/script.
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    await next();
});

var contentTypeProvider = new FileExtensionContentTypeProvider();
contentTypeProvider.Mappings[".avif"] = "image/avif";
app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = contentTypeProvider });

app.UseHttpsRedirection();
app.UseCors("AllowAngular");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Liveness: the process is up. Readiness: it can also reach the database.
app.MapHealthChecks("/health/live", new() { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new() { Predicate = check => check.Tags.Contains("ready") });

app.Run();
