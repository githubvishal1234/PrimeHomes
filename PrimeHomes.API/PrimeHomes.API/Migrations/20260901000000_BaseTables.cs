using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PrimeHomes.API.Data;

#nullable disable

namespace PrimeHomes.API.Migrations
{
    /// <summary>
    /// Users, Properties and Inquiries were originally created by hand (SQLQuery3.sql),
    /// so the later migrations assume they exist. This migration creates them on an
    /// empty database and is a no-op on databases that already have them.
    /// </summary>
    [DbContext(typeof(PrimeHomesDbContext))]
    [Migration("20260901000000_BaseTables")]
    public partial class BaseTables : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
CREATE TABLE dbo.Users
(
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Email NVARCHAR(150) NOT NULL UNIQUE,
    Phone NVARCHAR(20) NULL,
    Password NVARCHAR(255) NOT NULL,
    Role NVARCHAR(20) NOT NULL,
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Properties', N'U') IS NULL
CREATE TABLE dbo.Properties
(
    PropertyId INT IDENTITY(1,1) PRIMARY KEY,
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    PropertyType NVARCHAR(50) NOT NULL,
    BHK INT NULL,
    Price DECIMAL(18,2) NOT NULL,
    Area DECIMAL(10,2) NULL,
    Location NVARCHAR(200) NOT NULL,
    City NVARCHAR(100) NOT NULL,
    ImageUrl NVARCHAR(500) NULL,
    OwnerId INT NOT NULL CONSTRAINT FK_Properties_Users REFERENCES dbo.Users(UserId),
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Inquiries', N'U') IS NULL
CREATE TABLE dbo.Inquiries
(
    InquiryId INT IDENTITY(1,1) PRIMARY KEY,
    PropertyId INT NOT NULL CONSTRAINT FK_Inquiries_Properties REFERENCES dbo.Properties(PropertyId),
    BuyerId INT NOT NULL CONSTRAINT FK_Inquiries_Buyer REFERENCES dbo.Users(UserId),
    OwnerId INT NOT NULL CONSTRAINT FK_Inquiries_Owner REFERENCES dbo.Users(UserId),
    Message NVARCHAR(1000) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'New',
    CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally empty: these tables pre-date migrations on existing databases.
        }
    }
}
