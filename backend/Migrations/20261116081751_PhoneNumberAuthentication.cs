using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Grab.Api.Migrations
{
    /// <inheritdoc />
    public partial class PhoneNumberAuthentication : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Preserve account IDs, passwords and related records while canonicalizing login identifiers.
            // EF runs this migration in a transaction; invalid/duplicate legacy phones abort without data loss.
            migrationBuilder.Sql("""
                UPDATE [Users]
                SET [PhoneNumber] = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    LTRIM(RTRIM([PhoneNumber])), N' ', N''), N'-', N''), N'(', N''), N')', N''), N'.', N''),
                    NCHAR(9), N''), NCHAR(10), N''), NCHAR(13), N''), NCHAR(160), N'');

                UPDATE [Users] SET [PhoneNumber] = CASE
                    WHEN LEFT([PhoneNumber], 2) = N'00' THEN N'+' + SUBSTRING([PhoneNumber], 3, 30)
                    WHEN LEFT([PhoneNumber], 1) = N'0' THEN N'+855' + SUBSTRING([PhoneNumber], 2, 30)
                    WHEN LEN([PhoneNumber]) BETWEEN 7 AND 9
                        AND [PhoneNumber] COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^0-9]%'
                        AND LEFT([PhoneNumber], 1) BETWEEN N'1' AND N'9' THEN N'+855' + [PhoneNumber]
                    WHEN LEFT([PhoneNumber], 3) = N'855' THEN N'+' + [PhoneNumber]
                    ELSE [PhoneNumber] END;

                IF EXISTS (SELECT 1 FROM [Users] WHERE
                    LEN([PhoneNumber]) NOT BETWEEN 9 AND 16 OR LEFT([PhoneNumber], 1) <> N'+'
                    OR SUBSTRING([PhoneNumber], 2, 30) COLLATE Latin1_General_100_BIN2 LIKE N'%[^0-9]%'
                    OR SUBSTRING([PhoneNumber], 2, 1) = N'0'
                    OR (LEFT([PhoneNumber], 4) = N'+855' AND
                        (LEN([PhoneNumber]) NOT BETWEEN 11 AND 13 OR SUBSTRING([PhoneNumber], 5, 1) = N'0')))
                    THROW 50001, 'An existing account has an invalid phone number. Correct it before enabling phone login. No account was removed.', 1;

                IF EXISTS (SELECT 1 FROM [Users] GROUP BY [PhoneNumber] HAVING COUNT(*) > 1)
                    THROW 50002, 'Existing accounts share a normalized phone number. Assign distinct phone numbers before enabling phone login. No account was removed.', 1;
                """);

            migrationBuilder.DropIndex(
                name: "IX_Users_Email",
                table: "Users");

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Users",
                type: "nvarchar(254)",
                maxLength: 254,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(254)",
                oldMaxLength: 254);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true,
                filter: "[Email] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Users_PhoneNumber",
                table: "Users",
                column: "PhoneNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM [Users] WHERE [Email] IS NULL)
                    THROW 50003, 'Cannot restore email-required authentication while phone-only accounts exist. Assign their email addresses first.', 1;
                """);

            migrationBuilder.DropIndex(
                name: "IX_Users_Email",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_PhoneNumber",
                table: "Users");

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Users",
                type: "nvarchar(254)",
                maxLength: 254,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(254)",
                oldMaxLength: 254,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);
        }
    }
}
