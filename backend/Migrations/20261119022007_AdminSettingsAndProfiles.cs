using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Grab.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdminSettingsAndProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LastLoginAt",
                table: "Users",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SecurityVersion",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "AdminProfiles",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContactPhone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    JobTitle = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Bio = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    AvatarData = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    AvatarContentType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    RefreshSeconds = table.Column<int>(type: "int", nullable: false),
                    CompactTables = table.Column<bool>(type: "bit", nullable: false),
                    PasswordChangedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminProfiles", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_AdminProfiles_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PlatformSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    SupportEmail = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: false),
                    SupportPhone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    SupportHours = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    OfficeAddress = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    AnnouncementEnabled = table.Column<bool>(type: "bit", nullable: false),
                    Announcement = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    MaintenanceMode = table.Column<bool>(type: "bit", nullable: false),
                    MaintenanceMessage = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    RidesEnabled = table.Column<bool>(type: "bit", nullable: false),
                    FoodEnabled = table.Column<bool>(type: "bit", nullable: false),
                    ExpressEnabled = table.Column<bool>(type: "bit", nullable: false),
                    CustomerRegistrationEnabled = table.Column<bool>(type: "bit", nullable: false),
                    MerchantRegistrationEnabled = table.Column<bool>(type: "bit", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformSettings", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdminProfiles");

            migrationBuilder.DropTable(
                name: "PlatformSettings");

            migrationBuilder.DropColumn(
                name: "LastLoginAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "SecurityVersion",
                table: "Users");
        }
    }
}
