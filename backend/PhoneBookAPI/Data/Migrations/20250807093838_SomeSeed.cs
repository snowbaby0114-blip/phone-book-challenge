using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PhoneBookAPI.Data.Migrations
{
    /// <inheritdoc />
    public partial class SomeSeed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Contacts",
                columns: new[] { "Id", "CreatedAt", "Email", "Name", "PhoneNumber", "Surname", "UpdatedAt", "UserId" },
                values: new object[] { 1, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "joh@example.com", "joh", "+15551231234", "Smith", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 1);
        }
    }
}
