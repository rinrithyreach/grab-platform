using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Data;

public class GrabDbContext(DbContextOptions<GrabDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Driver> Drivers => Set<Driver>();
    public DbSet<Ride> Rides => Set<Ride>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<Merchant> Merchants => Set<Merchant>();
    public DbSet<MerchantListing> MerchantListings => Set<MerchantListing>();
    public DbSet<MerchantImage> MerchantImages => Set<MerchantImage>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(x => x.Email).IsUnique().HasFilter("[Email] IS NOT NULL");
        b.Entity<User>().HasIndex(x => x.PhoneNumber).IsUnique();
        b.Entity<User>().Property(x => x.Email).HasMaxLength(254);
        b.Entity<User>().Property(x => x.FullName).HasMaxLength(120);
        b.Entity<User>().Property(x => x.PhoneNumber).HasMaxLength(30);
        b.Entity<User>().Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
        b.Entity<Driver>().HasIndex(x => x.UserId).IsUnique();
        b.Entity<Driver>().HasIndex(x => x.VehiclePlate).IsUnique();
        b.Entity<Driver>().Property(x => x.VehiclePlate).HasMaxLength(30);
        b.Entity<Driver>().Property(x => x.VehicleType).HasMaxLength(50);
        b.Entity<Driver>().Property(x => x.Version).IsRowVersion();
        b.Entity<Driver>().HasOne<User>().WithOne().HasForeignKey<Driver>(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Ride>().HasOne<User>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Ride>().HasOne<Driver>().WithMany().HasForeignKey(x => x.DriverId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Ride>().Property(x => x.Version).IsRowVersion();
        b.Entity<Ride>().Property(x => x.Fare).HasPrecision(12, 2);
        b.Entity<Ride>().Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Entity<Ride>().Property(x => x.PickupLocation).HasMaxLength(300);
        b.Entity<Ride>().Property(x => x.Destination).HasMaxLength(300);
        b.Entity<Ride>().HasIndex(x => new { x.CustomerId, x.CreatedAt });
        b.Entity<Ride>().HasIndex(x => new { x.DriverId, x.Status });
        b.Entity<Payment>().HasOne<Ride>().WithOne().HasForeignKey<Payment>(x => x.RideId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Payment>().Property(x => x.Amount).HasPrecision(12, 2);
        b.Entity<Review>().HasOne<Ride>().WithOne().HasForeignKey<Review>(x => x.RideId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Review>().HasOne<User>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Review>().HasOne<Driver>().WithMany().HasForeignKey(x => x.DriverId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Review>().Property(x => x.Comment).HasMaxLength(1000);
        b.Entity<Review>().ToTable(t => t.HasCheckConstraint("CK_Reviews_Rating", "[Rating] BETWEEN 1 AND 5"));
        b.Entity<Merchant>().HasIndex(x => x.UserId).IsUnique();
        b.Entity<Merchant>().HasOne<User>().WithOne().HasForeignKey<Merchant>(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Merchant>().Property(x => x.Service).HasConversion<string>().HasMaxLength(20);
        b.Entity<Merchant>().Property(x => x.BusinessName).HasMaxLength(120);
        b.Entity<Merchant>().Property(x => x.OwnerName).HasMaxLength(120);
        b.Entity<Merchant>().Property(x => x.ContactPhone).HasMaxLength(30);
        b.Entity<Merchant>().Property(x => x.Email).HasMaxLength(254);
        b.Entity<Merchant>().Property(x => x.Address).HasMaxLength(300);
        b.Entity<Merchant>().Property(x => x.City).HasMaxLength(100);
        b.Entity<Merchant>().Property(x => x.Category).HasMaxLength(100);
        b.Entity<Merchant>().Property(x => x.Description).HasMaxLength(1500);
        b.Entity<Merchant>().Property(x => x.OpeningHours).HasMaxLength(200);
        b.Entity<Merchant>().Property(x => x.MotorcycleLicensePlate).HasMaxLength(30);
        b.Entity<MerchantListing>().HasOne(x => x.Merchant).WithMany().HasForeignKey(x => x.MerchantId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MerchantListing>().HasOne<MerchantImage>().WithMany().HasForeignKey(x => x.ImageId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MerchantListing>().Property(x => x.Title).HasMaxLength(120);
        b.Entity<MerchantListing>().Property(x => x.Description).HasMaxLength(1500);
        b.Entity<MerchantListing>().Property(x => x.Price).HasPrecision(12, 2);
        b.Entity<MerchantListing>().HasIndex(x => new { x.IsPublished, x.UpdatedAt });
        b.Entity<MerchantListing>().ToTable(t => t.HasCheckConstraint("CK_MerchantListings_Price", "[Price] > 0"));
        b.Entity<MerchantImage>().HasOne<Merchant>().WithMany().HasForeignKey(x => x.MerchantId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MerchantImage>().Property(x => x.ContentType).HasMaxLength(30);
    }
}
