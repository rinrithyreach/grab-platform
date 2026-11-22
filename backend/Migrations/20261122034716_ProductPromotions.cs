using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Grab.Api.Migrations
{
    /// <inheritdoc />
    public partial class ProductPromotions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint("CK_MerchantOrders_Total", "MerchantOrders");

            migrationBuilder.AddColumn<decimal>(
                name: "CodeDiscount",
                table: "MerchantOrders",
                type: "decimal(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Discount",
                table: "MerchantOrders",
                type: "decimal(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "PromoCode",
                table: "MerchantOrders",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddCheckConstraint("CK_MerchantOrders_Total", "MerchantOrders", "[Subtotal] > 0 AND [Discount] >= 0 AND [CodeDiscount] >= 0 AND [Subtotal] >= [Discount] + [CodeDiscount] AND [DeliveryFee] >= 0 AND [Total] = [Subtotal] - [Discount] - [CodeDiscount] + [DeliveryFee]");

            migrationBuilder.CreateTable(
                name: "Promotions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    Kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Value = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    MinSubtotal = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    MaxDiscount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: true),
                    BuyQuantity = table.Column<int>(type: "int", nullable: false),
                    FreeQuantity = table.Column<int>(type: "int", nullable: false),
                    StoreId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    ProductId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    FirstOrderOnly = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    StartsAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    EndsAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Promotions", x => x.Id);
                });

            migrationBuilder.Sql("""
                INSERT INTO [Promotions] ([Id], [Name], [Code], [Kind], [Value], [MinSubtotal], [MaxDiscount], [BuyQuantity], [FreeQuantity], [StoreId], [ProductId], [FirstOrderOnly], [IsActive], [StartsAt], [EndsAt], [UpdatedAt]) VALUES
                ('60000000-0000-0000-0000-000000000001', '$1 off orders of $3+', 'GROUP6', 'amount', 1, 3, NULL, 2, 1, NULL, NULL, 0, 1, NULL, NULL, '2026-11-22T00:00:00+00:00'),
                ('60000000-0000-0000-0000-000000000002', '10% off, up to $3', 'WELCOME10', 'percent', 10, 0, 3, 2, 1, NULL, NULL, 0, 1, NULL, NULL, '2026-11-22T00:00:00+00:00'),
                ('60000000-0000-0000-0000-000000000003', 'Free delivery', 'FREESHIP', 'freeDelivery', 0, 0, NULL, 2, 1, NULL, NULL, 0, 1, NULL, NULL, '2026-11-22T00:00:00+00:00'),
                ('60000000-0000-0000-0000-000000000004', '20% off first order', NULL, 'percent', 20, 0, NULL, 2, 1, 'golden-noodle', NULL, 1, 1, NULL, NULL, '2026-11-22T00:00:00+00:00'),
                ('60000000-0000-0000-0000-000000000005', 'Free delivery', NULL, 'freeDelivery', 0, 0, NULL, 2, 1, 'rice-bowl', NULL, 0, 1, NULL, NULL, '2026-11-22T00:00:00+00:00'),
                ('60000000-0000-0000-0000-000000000006', 'Buy 2 get 1', NULL, 'buyGetFree', 0, 0, NULL, 2, 1, 'sweet-spot', NULL, 0, 1, NULL, NULL, '2026-11-22T00:00:00+00:00'),
                ('60000000-0000-0000-0000-000000000007', '10% off over $20', NULL, 'percent', 10, 20, NULL, 2, 1, 'home-plus', NULL, 0, 1, NULL, NULL, '2026-11-22T00:00:00+00:00');
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Promotions_Code",
                table: "Promotions",
                column: "Code",
                unique: true,
                filter: "[Code] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint("CK_MerchantOrders_Total", "MerchantOrders");

            migrationBuilder.DropTable(
                name: "Promotions");

            migrationBuilder.DropColumn(
                name: "CodeDiscount",
                table: "MerchantOrders");

            migrationBuilder.DropColumn(
                name: "Discount",
                table: "MerchantOrders");

            migrationBuilder.DropColumn(
                name: "PromoCode",
                table: "MerchantOrders");

            migrationBuilder.AddCheckConstraint("CK_MerchantOrders_Total", "MerchantOrders", "[Subtotal] > 0 AND [DeliveryFee] >= 0 AND [Total] = [Subtotal] + [DeliveryFee]");
        }
    }
}
