using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace PhoneBookAPI.Data.Migrations
{
    /// <inheritdoc />
    public partial class SeedSampleData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 1,
                column: "Name",
                value: "Joh");

            migrationBuilder.InsertData(
                table: "Contacts",
                columns: new[] { "Id", "CreatedAt", "Email", "Name", "PhoneNumber", "Surname", "UpdatedAt", "UserId" },
                values: new object[,]
                {
                    { 2, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "amara@example.com", "Amara", "+15551230002", "Okafor", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 },
                    { 3, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "bruno@example.com", "Bruno", "+15551230003", "Cardoso", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 },
                    { 4, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "chen@example.com", "Chen", "+15551230004", "Wei", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 },
                    { 5, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "dalia@example.com", "Dalia", "+15551230005", "Haddad", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 },
                    { 6, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "eero@example.com", "Eero", "+15551230006", "Virtanen", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 },
                    { 7, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "fatima@example.com", "Fatima", "+15551230007", "Zahra", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 },
                    { 8, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "grigor@example.com", "Grigor", "+15551230008", "Petrov", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 },
                    { 9, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "hana@example.com", "Hana", "+15551230009", "Kobayashi", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 },
                    { 10, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "ingrid@example.com", "Ingrid", "+15551230010", "Larsen", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 },
                    { 11, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "javier@example.com", "Javier", "+15551230011", "Morales", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 },
                    { 12, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "keziah@example.com", "Keziah", "+15551230012", "Mwangi", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 },
                    { 13, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "liesel@example.com", "Liesel", "+15551230013", "Braun", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 },
                    { 14, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "mateo@example.com", "Mateo", "+15551230014", "Rossi", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 },
                    { 15, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "nadia@example.com", "Nadia", "+15551230015", "Popescu", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 1 }
                });

            migrationBuilder.InsertData(
                table: "Messages",
                columns: new[] { "Id", "Body", "ContactId", "Date", "Status", "Type", "UserId" },
                values: new object[,]
                {
                    { 1, "Confirming our appointment for next week.", 1, new DateTime(2025, 1, 1, 9, 0, 0, 0, DateTimeKind.Utc), 0, 0, 1 },
                    { 16, "Thanks for coming in today.", 1, new DateTime(2024, 12, 2, 16, 0, 0, 0, DateTimeKind.Utc), 0, 1, 1 },
                    { 2, "Your prescription is ready for collection.", 2, new DateTime(2024, 12, 30, 10, 0, 0, 0, DateTimeKind.Utc), 1, 1, 1 },
                    { 3, "Reminder: annual eye exam is due.", 3, new DateTime(2024, 12, 28, 11, 0, 0, 0, DateTimeKind.Utc), 2, 0, 1 },
                    { 4, "Thanks for coming in today.", 4, new DateTime(2024, 12, 26, 12, 0, 0, 0, DateTimeKind.Utc), 3, 1, 1 },
                    { 5, "We have moved your booking to the afternoon.", 5, new DateTime(2024, 12, 24, 13, 0, 0, 0, DateTimeKind.Utc), 4, 0, 1 },
                    { 6, "Your new frames have arrived.", 6, new DateTime(2024, 12, 22, 14, 0, 0, 0, DateTimeKind.Utc), 0, 1, 1 },
                    { 7, "Confirming our appointment for next week.", 7, new DateTime(2024, 12, 20, 15, 0, 0, 0, DateTimeKind.Utc), 1, 0, 1 },
                    { 8, "Your prescription is ready for collection.", 8, new DateTime(2024, 12, 18, 16, 0, 0, 0, DateTimeKind.Utc), 2, 1, 1 },
                    { 9, "Reminder: annual eye exam is due.", 9, new DateTime(2024, 12, 16, 9, 0, 0, 0, DateTimeKind.Utc), 3, 0, 1 },
                    { 10, "Thanks for coming in today.", 10, new DateTime(2024, 12, 14, 10, 0, 0, 0, DateTimeKind.Utc), 4, 1, 1 },
                    { 11, "We have moved your booking to the afternoon.", 11, new DateTime(2024, 12, 12, 11, 0, 0, 0, DateTimeKind.Utc), 0, 0, 1 },
                    { 12, "Your new frames have arrived.", 12, new DateTime(2024, 12, 10, 12, 0, 0, 0, DateTimeKind.Utc), 1, 1, 1 },
                    { 13, "Confirming our appointment for next week.", 13, new DateTime(2024, 12, 8, 13, 0, 0, 0, DateTimeKind.Utc), 2, 0, 1 },
                    { 14, "Your prescription is ready for collection.", 14, new DateTime(2024, 12, 6, 14, 0, 0, 0, DateTimeKind.Utc), 3, 1, 1 },
                    { 15, "Reminder: annual eye exam is due.", 15, new DateTime(2024, 12, 4, 15, 0, 0, 0, DateTimeKind.Utc), 4, 0, 1 },
                    { 17, "We have moved your booking to the afternoon.", 2, new DateTime(2024, 11, 30, 9, 0, 0, 0, DateTimeKind.Utc), 1, 0, 1 },
                    { 18, "Your new frames have arrived.", 3, new DateTime(2024, 11, 28, 10, 0, 0, 0, DateTimeKind.Utc), 2, 1, 1 },
                    { 19, "Confirming our appointment for next week.", 4, new DateTime(2024, 11, 26, 11, 0, 0, 0, DateTimeKind.Utc), 3, 0, 1 },
                    { 20, "Your prescription is ready for collection.", 5, new DateTime(2024, 11, 24, 12, 0, 0, 0, DateTimeKind.Utc), 4, 1, 1 },
                    { 21, "Reminder: annual eye exam is due.", 6, new DateTime(2024, 11, 22, 13, 0, 0, 0, DateTimeKind.Utc), 0, 0, 1 },
                    { 22, "Thanks for coming in today.", 7, new DateTime(2024, 11, 20, 14, 0, 0, 0, DateTimeKind.Utc), 1, 1, 1 },
                    { 23, "We have moved your booking to the afternoon.", 8, new DateTime(2024, 11, 18, 15, 0, 0, 0, DateTimeKind.Utc), 2, 0, 1 },
                    { 24, "Your new frames have arrived.", 9, new DateTime(2024, 11, 16, 16, 0, 0, 0, DateTimeKind.Utc), 3, 1, 1 },
                    { 25, "Confirming our appointment for next week.", 10, new DateTime(2024, 11, 14, 9, 0, 0, 0, DateTimeKind.Utc), 4, 0, 1 },
                    { 26, "Your prescription is ready for collection.", 11, new DateTime(2024, 11, 12, 10, 0, 0, 0, DateTimeKind.Utc), 0, 1, 1 },
                    { 27, "Reminder: annual eye exam is due.", 12, new DateTime(2024, 11, 10, 11, 0, 0, 0, DateTimeKind.Utc), 1, 0, 1 },
                    { 28, "Thanks for coming in today.", 13, new DateTime(2024, 11, 8, 12, 0, 0, 0, DateTimeKind.Utc), 2, 1, 1 },
                    { 29, "We have moved your booking to the afternoon.", 14, new DateTime(2024, 11, 6, 13, 0, 0, 0, DateTimeKind.Utc), 3, 0, 1 },
                    { 30, "Your new frames have arrived.", 15, new DateTime(2024, 11, 4, 14, 0, 0, 0, DateTimeKind.Utc), 4, 1, 1 }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 11);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 12);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 13);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 14);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 15);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 16);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 17);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 18);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 19);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 20);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 21);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 22);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 23);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 24);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 25);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 26);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 27);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 28);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 29);

            migrationBuilder.DeleteData(
                table: "Messages",
                keyColumn: "Id",
                keyValue: 30);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 11);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 12);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 13);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 14);

            migrationBuilder.DeleteData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 15);

            migrationBuilder.UpdateData(
                table: "Contacts",
                keyColumn: "Id",
                keyValue: 1,
                column: "Name",
                value: "joh");
        }
    }
}
