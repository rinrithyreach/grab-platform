using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Grab.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdminRolesAndPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AdminRoleId",
                table: "AdminProfiles",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AdminRoles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Permissions = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminRoles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminProfiles_AdminRoleId",
                table: "AdminProfiles",
                column: "AdminRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_AdminRoles_Name",
                table: "AdminRoles",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AdminProfiles_AdminRoles_AdminRoleId",
                table: "AdminProfiles",
                column: "AdminRoleId",
                principalTable: "AdminRoles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AdminProfiles_AdminRoles_AdminRoleId",
                table: "AdminProfiles");

            migrationBuilder.DropTable(
                name: "AdminRoles");

            migrationBuilder.DropIndex(
                name: "IX_AdminProfiles_AdminRoleId",
                table: "AdminProfiles");

            migrationBuilder.DropColumn(
                name: "AdminRoleId",
                table: "AdminProfiles");
        }
    }
}
