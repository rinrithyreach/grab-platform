using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Grab.Api.Migrations
{
    /// <inheritdoc />
    public partial class GuestRides : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "CustomerId",
                table: "Rides",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<string>(
                name: "GuestName",
                table: "Rides",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuestPhone",
                table: "Rides",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuestTokenHash",
                table: "Rides",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Rides_CustomerOrGuest",
                table: "Rides",
                sql: "[CustomerId] IS NOT NULL OR ([GuestName] IS NOT NULL AND [GuestPhone] IS NOT NULL AND [GuestTokenHash] IS NOT NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Rides_CustomerOrGuest",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "GuestName",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "GuestPhone",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "GuestTokenHash",
                table: "Rides");

            migrationBuilder.AlterColumn<Guid>(
                name: "CustomerId",
                table: "Rides",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);
        }
    }
}
