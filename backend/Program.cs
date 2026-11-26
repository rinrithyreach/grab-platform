using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Grab.Api.Configuration;
using Grab.Api.Data;
using Grab.Api.Interfaces;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Grab.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(o =>
{
    o.AddServerHeader = false;
    o.Limits.MaxRequestBodySize = 2_200_000; // Includes the bounded multipart image upload.
});
builder.Services.AddOptions<JwtSettings>().BindConfiguration("Jwt")
    .Validate(s => !string.IsNullOrWhiteSpace(s.SigningKey) && Encoding.UTF8.GetByteCount(s.SigningKey) >= 32,
        "Set Jwt:SigningKey using User Secrets or environment (32+ bytes).")
    .Validate(s => s.ExpiryMinutes is >= 5 and <= 120 && !string.IsNullOrWhiteSpace(s.Issuer) && !string.IsNullOrWhiteSpace(s.Audience), "Invalid JWT configuration.")
    .ValidateOnStart();
var jwt = builder.Configuration.GetSection("Jwt").Get<JwtSettings>() ?? new();
var connection = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connection))
    throw new InvalidOperationException("Configure ConnectionStrings:DefaultConnection.");
if (!builder.Environment.IsDevelopment())
{
    var sql = new SqlConnectionStringBuilder(connection);
    if (sql.Encrypt == SqlConnectionEncryptOption.Optional ||
        (sql.TrustServerCertificate && sql.Encrypt != SqlConnectionEncryptOption.Strict))
        throw new InvalidOperationException("SQL outside Development requires encryption and server certificate validation.");
}
builder.Services.AddDbContext<GrabDbContext>(o => o.UseSqlServer(connection));
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddSingleton<LoginPasswordVerifier>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<IAuthService>(sp => sp.GetRequiredService<AuthService>());
builder.Services.AddScoped<PlatformSettingsService>();
builder.Services.AddScoped<AdminAccountService>();
builder.Services.AddScoped<AdminTeamService>();
builder.Services.AddScoped<AdminAccessService>();
builder.Services.AddScoped<AdminRoleService>();
builder.Services.AddScoped<IRideService, RideService>();
builder.Services.AddScoped<IDriverService, DriverService>();
builder.Services.AddScoped<ICommerceService, CommerceService>();
builder.Services.AddScoped<MerchantService>();
builder.Services.AddScoped<BannerService>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddScoped<PromotionService>();
builder.Services.AddScoped<CategoryService>();
builder.Services.AddScoped<DeliveryService>();
builder.Services.AddScoped<AdminService>();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false)));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidIssuer = jwt.Issuer,
        ValidateAudience = true, ValidAudience = jwt.Audience,
        ValidateLifetime = true, RequireExpirationTime = true,
        ValidateIssuerSigningKey = true, IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256], ClockSkew = TimeSpan.FromSeconds(10),
        NameClaimType = "sub", RoleClaimType = "role"
    };
    o.Events = new JwtBearerEvents { OnTokenValidated = async context =>
    {
        if (!Guid.TryParse(context.Principal?.FindFirst("sub")?.Value, out var id)) { context.Fail("Invalid subject."); return; }
        var db = context.HttpContext.RequestServices.GetRequiredService<GrabDbContext>();
        var user = await db.Users.AsNoTracking().Where(x => x.Id == id).Select(x => new { x.IsActive, x.Role, x.SecurityVersion })
            .SingleOrDefaultAsync(context.HttpContext.RequestAborted);
        var version = context.Principal?.FindFirst("ver")?.Value;
        var validVersion = version is null ? 0 : int.TryParse(version, out var parsed) ? parsed : -1;
        if (user is null || !user.IsActive || user.SecurityVersion != validVersion || user.Role.ToString() != context.Principal?.FindFirst("role")?.Value)
            context.Fail("Account changed. Sign in again.");
    }};
});
builder.Services.AddAuthorization();
builder.Services.AddCors(o => o.AddPolicy("frontend", p => p.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:3000"])
    .WithHeaders("Content-Type", "Authorization", "X-Guest-Order-Token", "X-Guest-Ride-Token").WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")));
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.OnRejected = (context, _) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var delay))
            context.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(delay.TotalSeconds)).ToString(System.Globalization.CultureInfo.InvariantCulture);
        return ValueTask.CompletedTask;
    };
    o.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("delivery-quote", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("delivery-booking", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o =>
{
    o.SwaggerDoc("v1", new OpenApiInfo { Title = "Grab Platform API", Version = "v1", Description = "University demo. Flat development fares and payments are simulated." });
    o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme { Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" });
    o.AddSecurityRequirement(document => new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("Bearer", document)] = [] });
});
var app = builder.Build();
// Apply even to authentication failures and exception responses. API data includes
// access tokens, addresses and GPS positions and must not be retained by caches.
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        context.Response.Headers.XContentTypeOptions = "nosniff";
        context.Response.Headers.XFrameOptions = "DENY";
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
        if (context.Request.Path.StartsWithSegments("/api")
            && !context.Request.Path.StartsWithSegments("/api/merchant-images")
            && !context.Request.Path.StartsWithSegments("/api/banner-images"))
            context.Response.Headers.CacheControl = "no-store";
        return Task.CompletedTask;
    });
    await next(context);
});
app.UseExceptionHandler();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.MapGet("/", () => Results.Redirect("/swagger")).AllowAnonymous();
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseCors("frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

if (args.Contains("--provision-admin-stdin"))
{
    if (!app.Environment.IsDevelopment()) throw new InvalidOperationException("Local admin provisioning requires Development mode.");
    // Credentials arrive through stdin, never source code, command-line arguments or logs.
    var input = await Console.In.ReadLineAsync() ?? throw new InvalidOperationException("Admin credentials are required on stdin.");
    var credentials = System.Text.Json.JsonSerializer.Deserialize<Grab.Api.DTOs.AdminLoginRequest>(input,
        new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web))
        ?? throw new InvalidOperationException("Invalid admin credentials.");
    var email = credentials.Email.Trim().ToLowerInvariant();
    if (!new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(email) || email.Length > 254
        || credentials.Password.Length is < 12 or > 128) throw new InvalidOperationException("Use a valid email and a 12-128 character password.");
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
    var existing = await db.Users.SingleOrDefaultAsync(x => x.Email == email);
    if (existing is not null)
    {
        if (existing.Role != Role.Admin || !existing.IsActive || hasher.VerifyHashedPassword(existing, existing.PasswordHash, credentials.Password) == PasswordVerificationResult.Failed)
            throw new InvalidOperationException("This email already belongs to an account; no credentials or permissions were changed.");
        Console.WriteLine("Administrator already provisioned.");
        return;
    }
    var admin = new User { Email = email, PhoneNumber = "admin-" + Guid.NewGuid().ToString("N")[..20], FullName = "Super Administrator", Role = Role.Admin };
    admin.PasswordHash = hasher.HashPassword(admin, credentials.Password);
    db.Users.Add(admin);
    await db.SaveChangesAsync();
    Console.WriteLine("Administrator provisioned successfully.");
    return;
}
if (args.Contains("--bootstrap-admin"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
    var phone = PhoneNumbers.Normalize(builder.Configuration["Bootstrap:PhoneNumber"]);
    var password = builder.Configuration["Bootstrap:Password"];
    if (phone is null || password is null || password.Length is < 12 or > 128)
        throw new InvalidOperationException("Set Bootstrap:PhoneNumber and Bootstrap:Password (12–128 chars) via User Secrets first.");
    if (await db.Users.AnyAsync(x => x.Role == Role.Admin)) throw new InvalidOperationException("An admin already exists. Bootstrap is disabled.");
    if (await db.Users.AnyAsync(x => x.PhoneNumber == phone)) throw new InvalidOperationException("Use a new phone number for the initial admin.");
    var admin = new User { PhoneNumber = phone, FullName = "Platform Administrator", Role = Role.Admin };
    admin.PasswordHash = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>().HashPassword(admin, password);
    db.Users.Add(admin);
    await db.SaveChangesAsync();
    Console.WriteLine("Initial administrator created. Remove Bootstrap secrets now.");
    return;
}
app.Run();
public partial class Program { }
