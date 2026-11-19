using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PrimeHomes.API.Migrations
{
    /// <inheritdoc />
    public partial class AddListingLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AgeYears",
                table: "Properties",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedDate",
                table: "Properties",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Bathrooms",
                table: "Properties",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConstructionStatus",
                table: "Properties",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Facing",
                table: "Properties",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Floor",
                table: "Properties",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Furnishing",
                table: "Properties",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsVerified",
                table: "Properties",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ListingType",
                table: "Properties",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "Sale");

            migrationBuilder.AddColumn<int>(
                name: "Parking",
                table: "Properties",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectReason",
                table: "Properties",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TotalFloors",
                table: "Properties",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedDate",
                table: "Properties",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ViewCount",
                table: "Properties",
                type: "int",
                nullable: false,
                defaultValue: 0);
            // Dates used to be written in server local time; convert them to UTC (no-DST zones like IST convert exactly).
            migrationBuilder.Sql(@"
DECLARE @offset INT = DATEDIFF(MINUTE, GETUTCDATE(), GETDATE());
IF @offset <> 0
BEGIN
    UPDATE dbo.Users           SET CreatedDate = DATEADD(MINUTE, -@offset, CreatedDate);
    UPDATE dbo.Properties      SET CreatedDate = DATEADD(MINUTE, -@offset, CreatedDate);
    UPDATE dbo.Inquiries       SET CreatedDate = DATEADD(MINUTE, -@offset, CreatedDate);
    UPDATE dbo.Notifications   SET CreatedDate = DATEADD(MINUTE, -@offset, CreatedDate);
    UPDATE dbo.ContactRequests SET CreatedDate = DATEADD(MINUTE, -@offset, CreatedDate);
    UPDATE dbo.PropertyReviews SET CreatedDate = DATEADD(MINUTE, -@offset, CreatedDate);
    UPDATE dbo.UserProfiles    SET UpdatedDate = DATEADD(MINUTE, -@offset, UpdatedDate);
END;

-- Existing live listings start a fresh 90-day window instead of expiring on upgrade.
UPDATE dbo.Properties SET ApprovedDate = CreatedDate, UpdatedDate = SYSUTCDATETIME() WHERE Status = 'Approved';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AgeYears",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "ApprovedDate",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "Bathrooms",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "ConstructionStatus",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "Facing",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "Floor",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "Furnishing",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "IsVerified",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "ListingType",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "Parking",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "RejectReason",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "TotalFloors",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "UpdatedDate",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "ViewCount",
                table: "Properties");
        }
    }
}
