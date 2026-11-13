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
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(x => x.Email).IsUnique();
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
    }
}
