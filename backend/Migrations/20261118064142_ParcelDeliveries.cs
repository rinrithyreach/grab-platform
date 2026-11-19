using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Grab.Api.Migrations
{
    /// <inheritdoc />
    public partial class ParcelDeliveries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ParcelDeliveries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourierMerchantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ServiceType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    VehicleType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PaymentMethod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    InsuranceTier = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PickupName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    PickupPhone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    PickupAddress = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    PickupLatitude = table.Column<double>(type: "float", nullable: false),
                    PickupLongitude = table.Column<double>(type: "float", nullable: false),
                    ScheduledPickupAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    BaseFare = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    DistanceFare = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    VehicleFare = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    SizeFare = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    ExtraStopFare = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    InsuranceFare = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    CodFee = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    TotalFare = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    CodAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    DistanceKm = table.Column<double>(type: "float", nullable: false),
                    PricingMode = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    AcceptedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    PickedUpAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CancelledAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CourierLatitude = table.Column<double>(type: "float", nullable: true),
                    CourierLongitude = table.Column<double>(type: "float", nullable: true),
                    CourierLocationAccuracy = table.Column<double>(type: "float", nullable: true),
                    CourierLocationUpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    PickupProofPhotoId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParcelDeliveries", x => x.Id);
                    table.CheckConstraint("CK_ParcelDeliveries_Fare", "[TotalFare] = [BaseFare] + [DistanceFare] + [VehicleFare] + [SizeFare] + [ExtraStopFare] + [InsuranceFare] + [CodFee] AND [TotalFare] >= 0 AND [CodAmount] >= 0");
                    table.ForeignKey(
                        name: "FK_ParcelDeliveries_MerchantImages_PickupProofPhotoId",
                        column: x => x.PickupProofPhotoId,
                        principalTable: "MerchantImages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParcelDeliveries_Merchants_CourierMerchantId",
                        column: x => x.CourierMerchantId,
                        principalTable: "Merchants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParcelDeliveries_Users_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DeliveryStops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DeliveryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    RecipientName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    RecipientPhone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Latitude = table.Column<double>(type: "float", nullable: false),
                    Longitude = table.Column<double>(type: "float", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ParcelSize = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    WeightKg = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    CodAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    CodCollected = table.Column<bool>(type: "bit", nullable: false),
                    CodPaidOut = table.Column<bool>(type: "bit", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DeliveredAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ProofPhotoId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    FailureReason = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeliveryStops", x => x.Id);
                    table.CheckConstraint("CK_DeliveryStops_Values", "[Position] BETWEEN 1 AND 5 AND [WeightKg] > 0 AND [CodAmount] BETWEEN 0 AND 200");
                    table.ForeignKey(
                        name: "FK_DeliveryStops_MerchantImages_ProofPhotoId",
                        column: x => x.ProofPhotoId,
                        principalTable: "MerchantImages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DeliveryStops_ParcelDeliveries_DeliveryId",
                        column: x => x.DeliveryId,
                        principalTable: "ParcelDeliveries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryStops_DeliveryId_Position",
                table: "DeliveryStops",
                columns: new[] { "DeliveryId", "Position" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryStops_ProofPhotoId",
                table: "DeliveryStops",
                column: "ProofPhotoId");

            migrationBuilder.CreateIndex(
                name: "IX_ParcelDeliveries_CourierMerchantId",
                table: "ParcelDeliveries",
                column: "CourierMerchantId",
                unique: true,
                filter: "[CourierMerchantId] IS NOT NULL AND [Status] IN (N'Accepted', N'PickedUp', N'InTransit')");

            migrationBuilder.CreateIndex(
                name: "IX_ParcelDeliveries_CustomerId_CreatedAt",
                table: "ParcelDeliveries",
                columns: new[] { "CustomerId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ParcelDeliveries_PickupProofPhotoId",
                table: "ParcelDeliveries",
                column: "PickupProofPhotoId");

            migrationBuilder.CreateIndex(
                name: "IX_ParcelDeliveries_Status_VehicleType_CreatedAt",
                table: "ParcelDeliveries",
                columns: new[] { "Status", "VehicleType", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DeliveryStops");

            migrationBuilder.DropTable(
                name: "ParcelDeliveries");
        }
    }
}
