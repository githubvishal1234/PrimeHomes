using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PrimeHomes.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAlertsAnalytics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ApprovedPrice",
                table: "Properties",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PropertyViewsDaily",
                columns: table => new
                {
                    PropertyId = table.Column<int>(type: "int", nullable: false),
                    Day = table.Column<DateTime>(type: "date", nullable: false),
                    Views = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PropertyViewsDaily", x => new { x.PropertyId, x.Day });
                });

            migrationBuilder.CreateTable(
                name: "SavedSearches",
                columns: table => new
                {
                    SavedSearchId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Query = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    AlertsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastAlertDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedSearches", x => x.SavedSearchId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SavedSearches_UserId",
                table: "SavedSearches",
                column: "UserId");

            // Live listings start with their current price as the baseline for price-drop alerts.
            migrationBuilder.Sql("UPDATE dbo.Properties SET ApprovedPrice = Price WHERE Status = 'Approved';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PropertyViewsDaily");

            migrationBuilder.DropTable(
                name: "SavedSearches");

            migrationBuilder.DropColumn(
                name: "ApprovedPrice",
                table: "Properties");
        }
    }
}
