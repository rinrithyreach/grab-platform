using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Grab.Api.Migrations
{
    /// <inheritdoc />
    public partial class SharedStorageIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SharedStorageIdentities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StorageId = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SharedStorageIdentities", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "SharedStorageIdentities",
                column: "Id",
                value: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SharedStorageIdentities");
        }
    }
}
