using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Grab.Api.Migrations
{
    /// <inheritdoc />
    public partial class MerchantRideDispatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "MerchantId",
                table: "Rides",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RideMerchantResponses",
                columns: table => new
                {
                    RideId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MerchantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Accepted = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    RespondedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RideMerchantResponses", x => new { x.RideId, x.MerchantId });
                    table.CheckConstraint("CK_RideMerchantResponses_ActiveAccepted", "[IsActive] = 0 OR [Accepted] = 1");
                    table.ForeignKey(
                        name: "FK_RideMerchantResponses_Merchants_MerchantId",
                        column: x => x.MerchantId,
                        principalTable: "Merchants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RideMerchantResponses_Rides_RideId",
                        column: x => x.RideId,
                        principalTable: "Rides",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Rides_MerchantId_Status",
                table: "Rides",
                columns: new[] { "MerchantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_RideMerchantResponses_MerchantId",
                table: "RideMerchantResponses",
                column: "MerchantId",
                unique: true,
                filter: "[IsActive] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_RideMerchantResponses_RideId",
                table: "RideMerchantResponses",
                column: "RideId",
                unique: true,
                filter: "[IsActive] = 1");

            migrationBuilder.AddForeignKey(
                name: "FK_Rides_Merchants_MerchantId",
                table: "Rides",
                column: "MerchantId",
                principalTable: "Merchants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Rides_Merchants_MerchantId",
                table: "Rides");

            migrationBuilder.DropTable(
                name: "RideMerchantResponses");

            migrationBuilder.DropIndex(
                name: "IX_Rides_MerchantId_Status",
                table: "Rides");

            migrationBuilder.DropColumn(
                name: "MerchantId",
                table: "Rides");
        }
    }
}
