using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Grab.Api.Migrations
{
    /// <inheritdoc />
    public partial class RideLiveLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "DriverLatitude",
                table: "Rides",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "DriverLocationAccuracy",
                table: "Rides",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DriverLocationUpdatedAt",
                table: "Rides",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "DriverLongitude",
                table: "Rides",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DriverLatitude",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "DriverLocationAccuracy",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "DriverLocationUpdatedAt",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "DriverLongitude",
                table: "Rides");
        }
    }
}
