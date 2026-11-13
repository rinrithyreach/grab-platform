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
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOptions<JwtSettings>().BindConfiguration("Jwt")
    .Validate(s => Encoding.UTF8.GetByteCount(s.SigningKey) >= 32, "Set Jwt:SigningKey using User Secrets or environment (32+ bytes).")
    .Validate(s => s.ExpiryMinutes is >= 5 and <= 120 && !string.IsNullOrWhiteSpace(s.Issuer) && !string.IsNullOrWhiteSpace(s.Audience), "Invalid JWT configuration.")
    .ValidateOnStart();
var jwt = builder.Configuration.GetSection("Jwt").Get<JwtSettings>() ?? new();
builder.Services.AddDbContext<GrabDbContext>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Configure ConnectionStrings:DefaultConnection.")));
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IRideService, RideService>();
builder.Services.AddScoped<IDriverService, DriverService>();
builder.Services.AddScoped<ICommerceService, CommerceService>();
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
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, context.HttpContext.RequestAborted);
        if (user is null || user.Role.ToString() != context.Principal?.FindFirst("role")?.Value) context.Fail("Account changed. Sign in again.");
    }};
});
builder.Services.AddAuthorization();
builder.Services.AddCors(o => o.AddPolicy("frontend", p => p.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:3000"])
    .WithHeaders("Content-Type", "Authorization").WithMethods("GET", "POST", "PATCH")));
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o =>
{
    o.SwaggerDoc("v1", new OpenApiInfo { Title = "Grab Platform API", Version = "v1", Description = "University demo. Flat development fares and payments are simulated." });
    o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme { Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" });
    o.AddSecurityRequirement(document => new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("Bearer", document)] = [] });
});
var app = builder.Build();
app.UseExceptionHandler();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
else app.UseHttpsRedirection();
app.UseCors("frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

if (args.Contains("--bootstrap-admin"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<GrabDbContext>();
    var email = builder.Configuration["Bootstrap:Email"]?.Trim().ToLowerInvariant();
    var password = builder.Configuration["Bootstrap:Password"];
    if (string.IsNullOrWhiteSpace(email) || password is null || password.Length < 12)
        throw new InvalidOperationException("Set Bootstrap:Email and Bootstrap:Password (12+ chars) via User Secrets first.");
    if (await db.Users.AnyAsync(x => x.Role == Role.Admin)) throw new InvalidOperationException("An admin already exists. Bootstrap is disabled.");
    if (await db.Users.AnyAsync(x => x.Email == email)) throw new InvalidOperationException("Use a new email for the initial admin.");
    var admin = new User { Email = email, FullName = "Platform Administrator", Role = Role.Admin };
    admin.PasswordHash = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>().HashPassword(admin, password);
    db.Users.Add(admin);
    await db.SaveChangesAsync();
    Console.WriteLine("Initial administrator created. Remove Bootstrap secrets now.");
    return;
}
app.Run();
public partial class Program { }
