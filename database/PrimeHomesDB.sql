/*
  PrimeHomes database: full schema + demo data.

  Run in SQL Server Management Studio, Azure Data Studio, or:
      sqlcmd -S localhost\SQLEXPRESS -E -C -i PrimeHomesDB.sql

  Creates the database PrimeHomesDB if it does not exist, applies every EF Core migration
  (safe to re-run), then inserts the demo data. Run it on an empty PrimeHomesDB.

  Demo logins (passwords are stored hashed):
    Admin  admin@primehomes.com   / Admin@123
    Owner  ravi@primehomes.com    / Ravi@123
    Owner  suresh@primehomes.com  / Suresh@123
    Owner  anusha@primehomes.com  / anusha@123
    Buyer  venkat@primehomes.com  / Venkat@123
    Buyer  shareef@gmail.com      / shareef@123

  Listing photos referenced here live in PrimeHomes.API/PrimeHomes.API/wwwroot/uploads.
*/
IF DB_ID(N'PrimeHomesDB') IS NULL CREATE DATABASE PrimeHomesDB;
GO
USE PrimeHomesDB;
GO

-- ===================== SCHEMA (EF Core migrations, idempotent) =====================
IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260901000000_BaseTables'
)
BEGIN
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
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260901000000_BaseTables'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260901000000_BaseTables', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925052350_InitialCreate'
)
BEGIN
    CREATE TABLE [PropertyImages] (
        [PropertyImageId] int NOT NULL IDENTITY,
        [PropertyId] int NOT NULL,
        [ImageUrl] nvarchar(max) NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_PropertyImages] PRIMARY KEY ([PropertyImageId]),
        CONSTRAINT [FK_PropertyImages_Properties_PropertyId] FOREIGN KEY ([PropertyId]) REFERENCES [Properties] ([PropertyId]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925052350_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_PropertyImages_PropertyId] ON [PropertyImages] ([PropertyId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925052350_InitialCreate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260925052350_InitialCreate', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928072418_AddFavorites'
)
BEGIN
    CREATE TABLE [Favorites] (
        [FavoriteId] int NOT NULL IDENTITY,
        [BuyerId] int NOT NULL,
        [PropertyId] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_Favorites] PRIMARY KEY ([FavoriteId]),
        CONSTRAINT [FK_Favorites_Properties_PropertyId] FOREIGN KEY ([PropertyId]) REFERENCES [Properties] ([PropertyId]) ON DELETE CASCADE,
        CONSTRAINT [FK_Favorites_Users_BuyerId] FOREIGN KEY ([BuyerId]) REFERENCES [Users] ([UserId]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928072418_AddFavorites'
)
BEGIN
    CREATE INDEX [IX_Favorites_BuyerId] ON [Favorites] ([BuyerId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928072418_AddFavorites'
)
BEGIN
    CREATE INDEX [IX_Favorites_PropertyId] ON [Favorites] ([PropertyId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928072418_AddFavorites'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260928072418_AddFavorites', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005050745_AddPropertyBadge'
)
BEGIN
    ALTER TABLE [Properties] ADD [Badge] nvarchar(max) NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005050745_AddPropertyBadge'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261005050745_AddPropertyBadge', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005062930_AddUserProfile'
)
BEGIN
    CREATE TABLE [UserProfiles] (
        [UserProfileId] int NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [ProfileImageUrl] nvarchar(max) NULL,
        [City] nvarchar(max) NULL,
        [State] nvarchar(max) NULL,
        [Bio] nvarchar(max) NULL,
        [CompanyName] nvarchar(max) NULL,
        [PreferredCity] nvarchar(max) NULL,
        [PreferredPropertyType] nvarchar(max) NULL,
        [PreferredBHK] int NULL,
        [MinBudget] decimal(18,2) NULL,
        [MaxBudget] decimal(18,2) NULL,
        [UpdatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_UserProfiles] PRIMARY KEY ([UserProfileId]),
        CONSTRAINT [FK_UserProfiles_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005062930_AddUserProfile'
)
BEGIN
    CREATE INDEX [IX_UserProfiles_UserId] ON [UserProfiles] ([UserId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005062930_AddUserProfile'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261005062930_AddUserProfile', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006095901_AddNotification'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261006095901_AddNotification', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006103802_CreateNotificationsTable'
)
BEGIN
    CREATE TABLE [Notifications] (
        [NotificationId] int NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [Title] nvarchar(max) NOT NULL,
        [Message] nvarchar(max) NOT NULL,
        [Type] nvarchar(max) NOT NULL,
        [IsRead] bit NOT NULL,
        [RelatedPropertyId] int NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_Notifications] PRIMARY KEY ([NotificationId])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006103802_CreateNotificationsTable'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261006103802_CreateNotificationsTable', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007110216_AddContactRequest'
)
BEGIN
    CREATE TABLE [ContactRequests] (
        [ContactRequestId] int NOT NULL IDENTITY,
        [UserId] int NULL,
        [PropertyId] int NULL,
        [FullName] nvarchar(max) NOT NULL,
        [Email] nvarchar(max) NOT NULL,
        [PhoneNumber] nvarchar(max) NOT NULL,
        [InterestedIn] nvarchar(max) NOT NULL,
        [Message] nvarchar(max) NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_ContactRequests] PRIMARY KEY ([ContactRequestId])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007110216_AddContactRequest'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261007110216_AddContactRequest', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261012052340_AddPropertyCoordinates'
)
BEGIN
    ALTER TABLE [Properties] ADD [Latitude] float NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261012052340_AddPropertyCoordinates'
)
BEGIN
    ALTER TABLE [Properties] ADD [Longitude] float NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261012052340_AddPropertyCoordinates'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261012052340_AddPropertyCoordinates', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013110026_AddPropertyReviews'
)
BEGIN
    CREATE TABLE [PropertyReviews] (
        [ReviewId] int NOT NULL IDENTITY,
        [PropertyId] int NOT NULL,
        [UserId] int NOT NULL,
        [Rating] int NOT NULL,
        [Comment] nvarchar(max) NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_PropertyReviews] PRIMARY KEY ([ReviewId]),
        CONSTRAINT [FK_PropertyReviews_Properties_PropertyId] FOREIGN KEY ([PropertyId]) REFERENCES [Properties] ([PropertyId]) ON DELETE CASCADE,
        CONSTRAINT [FK_PropertyReviews_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013110026_AddPropertyReviews'
)
BEGIN
    CREATE INDEX [IX_PropertyReviews_PropertyId] ON [PropertyReviews] ([PropertyId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013110026_AddPropertyReviews'
)
BEGIN
    CREATE INDEX [IX_PropertyReviews_UserId] ON [PropertyReviews] ([UserId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013110026_AddPropertyReviews'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261013110026_AddPropertyReviews', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014090640_AddPropertyLifestyleFeatures'
)
BEGIN
    ALTER TABLE [Properties] ADD [LifestyleFeatures] nvarchar(max) NOT NULL DEFAULT N'';
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261014090640_AddPropertyLifestyleFeatures'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261014090640_AddPropertyLifestyleFeatures', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [AgeYears] int NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [ApprovedDate] datetime2 NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [Bathrooms] int NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [ConstructionStatus] nvarchar(max) NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [Facing] nvarchar(max) NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [Floor] int NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [Furnishing] nvarchar(max) NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [IsVerified] bit NOT NULL DEFAULT CAST(0 AS bit);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [ListingType] nvarchar(max) NOT NULL DEFAULT N'Sale';
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [Parking] int NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [RejectReason] nvarchar(max) NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [TotalFloors] int NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [UpdatedDate] datetime2 NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    ALTER TABLE [Properties] ADD [ViewCount] int NOT NULL DEFAULT 0;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
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
    UPDATE dbo.Properties SET ApprovedDate = CreatedDate, UpdatedDate = SYSUTCDATETIME() WHERE Status = 'Approved';
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118092904_AddListingLifecycle'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261118092904_AddListingLifecycle', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    ALTER TABLE [Users] ADD [EmailVerified] bit NOT NULL DEFAULT CAST(0 AS bit);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    ALTER TABLE [Inquiries] ADD [OwnerReply] nvarchar(max) NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    ALTER TABLE [Inquiries] ADD [RespondedDate] datetime2 NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    DECLARE @var0 sysname;
    SELECT @var0 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ContactRequests]') AND [c].[name] = N'PhoneNumber');
    IF @var0 IS NOT NULL EXEC(N'ALTER TABLE [ContactRequests] DROP CONSTRAINT [' + @var0 + '];');
    ALTER TABLE [ContactRequests] ALTER COLUMN [PhoneNumber] nvarchar(20) NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    DECLARE @var1 sysname;
    SELECT @var1 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ContactRequests]') AND [c].[name] = N'Message');
    IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [ContactRequests] DROP CONSTRAINT [' + @var1 + '];');
    ALTER TABLE [ContactRequests] ALTER COLUMN [Message] nvarchar(1000) NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    DECLARE @var2 sysname;
    SELECT @var2 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ContactRequests]') AND [c].[name] = N'InterestedIn');
    IF @var2 IS NOT NULL EXEC(N'ALTER TABLE [ContactRequests] DROP CONSTRAINT [' + @var2 + '];');
    ALTER TABLE [ContactRequests] ALTER COLUMN [InterestedIn] nvarchar(50) NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    DECLARE @var3 sysname;
    SELECT @var3 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ContactRequests]') AND [c].[name] = N'FullName');
    IF @var3 IS NOT NULL EXEC(N'ALTER TABLE [ContactRequests] DROP CONSTRAINT [' + @var3 + '];');
    ALTER TABLE [ContactRequests] ALTER COLUMN [FullName] nvarchar(100) NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    DECLARE @var4 sysname;
    SELECT @var4 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ContactRequests]') AND [c].[name] = N'Email');
    IF @var4 IS NOT NULL EXEC(N'ALTER TABLE [ContactRequests] DROP CONSTRAINT [' + @var4 + '];');
    ALTER TABLE [ContactRequests] ALTER COLUMN [Email] nvarchar(150) NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    CREATE TABLE [SiteVisits] (
        [SiteVisitId] int NOT NULL IDENTITY,
        [PropertyId] int NOT NULL,
        [BuyerId] int NOT NULL,
        [OwnerId] int NOT NULL,
        [ScheduledAt] datetime2 NOT NULL,
        [Status] nvarchar(450) NOT NULL,
        [Note] nvarchar(500) NULL,
        [ReminderSent] bit NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [UpdatedDate] datetime2 NULL,
        CONSTRAINT [PK_SiteVisits] PRIMARY KEY ([SiteVisitId]),
        CONSTRAINT [FK_SiteVisits_Properties_PropertyId] FOREIGN KEY ([PropertyId]) REFERENCES [Properties] ([PropertyId]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    CREATE TABLE [UserTokens] (
        [UserTokenId] int NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [Purpose] nvarchar(450) NOT NULL,
        [TokenHash] nvarchar(max) NOT NULL,
        [ExpiresAt] datetime2 NOT NULL,
        [UsedAt] datetime2 NULL,
        CONSTRAINT [PK_UserTokens] PRIMARY KEY ([UserTokenId])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    CREATE INDEX [IX_SiteVisits_PropertyId] ON [SiteVisits] ([PropertyId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    CREATE INDEX [IX_SiteVisits_Status_ScheduledAt] ON [SiteVisits] ([Status], [ScheduledAt]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    CREATE INDEX [IX_UserTokens_UserId_Purpose] ON [UserTokens] ([UserId], [Purpose]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    UPDATE dbo.Users SET EmailVerified = 1;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118093954_AddAccountsAndSiteVisits'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261118093954_AddAccountsAndSiteVisits', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118101546_AddAlertsAnalytics'
)
BEGIN
    ALTER TABLE [Properties] ADD [ApprovedPrice] decimal(18,2) NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118101546_AddAlertsAnalytics'
)
BEGIN
    CREATE TABLE [PropertyViewsDaily] (
        [PropertyId] int NOT NULL,
        [Day] date NOT NULL,
        [Views] int NOT NULL,
        CONSTRAINT [PK_PropertyViewsDaily] PRIMARY KEY ([PropertyId], [Day])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118101546_AddAlertsAnalytics'
)
BEGIN
    CREATE TABLE [SavedSearches] (
        [SavedSearchId] int NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [Name] nvarchar(120) NOT NULL,
        [Query] nvarchar(1000) NOT NULL,
        [AlertsEnabled] bit NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [LastAlertDate] datetime2 NULL,
        CONSTRAINT [PK_SavedSearches] PRIMARY KEY ([SavedSearchId])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118101546_AddAlertsAnalytics'
)
BEGIN
    CREATE INDEX [IX_SavedSearches_UserId] ON [SavedSearches] ([UserId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118101546_AddAlertsAnalytics'
)
BEGIN
    UPDATE dbo.Properties SET ApprovedPrice = Price WHERE Status = 'Approved';
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118101546_AddAlertsAnalytics'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261118101546_AddAlertsAnalytics', N'8.0.0');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118103708_HardenSessions'
)
BEGIN
    DECLARE @var5 sysname;
    SELECT @var5 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[UserTokens]') AND [c].[name] = N'TokenHash');
    IF @var5 IS NOT NULL EXEC(N'ALTER TABLE [UserTokens] DROP CONSTRAINT [' + @var5 + '];');
    ALTER TABLE [UserTokens] ALTER COLUMN [TokenHash] nvarchar(64) NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118103708_HardenSessions'
)
BEGIN
    DROP INDEX [IX_UserTokens_UserId_Purpose] ON [UserTokens];
    DECLARE @var6 sysname;
    SELECT @var6 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[UserTokens]') AND [c].[name] = N'Purpose');
    IF @var6 IS NOT NULL EXEC(N'ALTER TABLE [UserTokens] DROP CONSTRAINT [' + @var6 + '];');
    ALTER TABLE [UserTokens] ALTER COLUMN [Purpose] nvarchar(32) NOT NULL;
    CREATE INDEX [IX_UserTokens_UserId_Purpose] ON [UserTokens] ([UserId], [Purpose]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118103708_HardenSessions'
)
BEGIN
    CREATE INDEX [IX_UserTokens_TokenHash] ON [UserTokens] ([TokenHash]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261118103708_HardenSessions'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261118103708_HardenSessions', N'8.0.0');
END;
GO

COMMIT;
GO



-- ===================== DATA =====================

-- Users
SET IDENTITY_INSERT dbo.[Users] ON;
INSERT INTO dbo.[Users] ([UserId], [Name], [Email], [Phone], [Password], [Role], [CreatedDate], [EmailVerified]) VALUES (N'1', N'Prime Admin', N'admin@primehomes.com', N'9000000001', N'AQAAAAIAAYagAAAAEOdm3/9Sqn+hxGhBvjUhLjnc7JffM5hhcl6ShG37T0WPh+RgVi3+odCNu8r/6F1rMQ==', N'Admin', N'2026-11-18T08:41:07.173', N'1');
INSERT INTO dbo.[Users] ([UserId], [Name], [Email], [Phone], [Password], [Role], [CreatedDate], [EmailVerified]) VALUES (N'2', N'Ravi Kumar', N'ravi@primehomes.com', N'9000000002', N'AQAAAAIAAYagAAAAECAyVTmnvpNsolZzYCZ4FvYPe0upPgb8s1bDma9+lw3+U88CMJoTr4lc1WiRul1F0Q==', N'Owner', N'2026-11-18T08:41:07.173', N'1');
INSERT INTO dbo.[Users] ([UserId], [Name], [Email], [Phone], [Password], [Role], [CreatedDate], [EmailVerified]) VALUES (N'3', N'Venkat', N'venkat@primehomes.com', N'9000000003', N'AQAAAAIAAYagAAAAENan9jlCvjYnohKVpfkeFIEN1b/zJ/07x8zdNlst6Z5vIdf3p/2bdod57QjChNxdCQ==', N'Buyer', N'2026-11-18T08:41:07.173', N'1');
INSERT INTO dbo.[Users] ([UserId], [Name], [Email], [Phone], [Password], [Role], [CreatedDate], [EmailVerified]) VALUES (N'4', N'Suresh Kumar', N'suresh@primehomes.com', N'9876543210', N'AQAAAAIAAYagAAAAEKhgHvE4WakMyh+rLLqQF/23YDtH3a/AZgcjXtY9ozVXUqG6PL4haIvpn51Sie2EfA==', N'Owner', N'2026-11-18T09:01:29.427', N'1');
INSERT INTO dbo.[Users] ([UserId], [Name], [Email], [Phone], [Password], [Role], [CreatedDate], [EmailVerified]) VALUES (N'5', N'shareef', N'shareef@gmail.com', NULL, N'AQAAAAIAAYagAAAAEBDVh+cuRLcFTLqG+EhijmNeCuWMmJEDiryRE+RhDOofoorQxdcf7DSdmN/gENoL3g==', N'Buyer', N'2026-11-18T09:01:29.427', N'1');
INSERT INTO dbo.[Users] ([UserId], [Name], [Email], [Phone], [Password], [Role], [CreatedDate], [EmailVerified]) VALUES (N'6', N'Anusha', N'anusha@primehomes.com', NULL, N'AQAAAAIAAYagAAAAEAghsg5yZgdy861PuaDLX9kW5SgeO47Ioks9oKID3/2gIsM93jRGZtU5Xv/3VSM1dw==', N'Owner', N'2026-11-18T09:01:29.427', N'1');
SET IDENTITY_INSERT dbo.[Users] OFF;
GO

-- Properties
SET IDENTITY_INSERT dbo.[Properties] ON;
INSERT INTO dbo.[Properties] ([PropertyId], [Title], [Description], [PropertyType], [BHK], [Price], [Area], [Location], [City], [ImageUrl], [OwnerId], [Status], [CreatedDate], [Badge], [Latitude], [Longitude], [LifestyleFeatures], [AgeYears], [ApprovedDate], [Bathrooms], [ConstructionStatus], [Facing], [Floor], [Furnishing], [IsVerified], [ListingType], [Parking], [RejectReason], [TotalFloors], [UpdatedDate], [ViewCount], [ApprovedPrice]) VALUES (N'3', N'Spacious 3 BHK with lake view in Kondapur', N'Spacious 3 BHK with lake view in Kondapur. 3 BHK apartment in Kondapur, Hyderabad: 1,850 sq ft, semi-furnished, east-facing. Close to schools, hospitals and daily needs.', N'Apartment', N'3', N'12500000.00', N'1850.00', N'Kondapur', N'Hyderabad', N'/uploads/ph-kondapur-3bhk.webp', N'2', N'Approved', N'2026-11-15T09:40:32.220', N'FEATURED', N'1.747000000000000e+001', N'7.835700000000000e+001', N'["Swimming Pool","Fitness Centre","Clubhouse","Security","Parking"]', N'3', N'2026-11-15T13:40:32.2205038', N'3', N'Ready to move', N'East', N'9', N'Semi-furnished', N'1', N'Sale', N'2', NULL, N'18', N'2026-11-18T09:40:32.2205038', N'11', N'12500000.00');
INSERT INTO dbo.[Properties] ([PropertyId], [Title], [Description], [PropertyType], [BHK], [Price], [Area], [Location], [City], [ImageUrl], [OwnerId], [Status], [CreatedDate], [Badge], [Latitude], [Longitude], [LifestyleFeatures], [AgeYears], [ApprovedDate], [Bathrooms], [ConstructionStatus], [Facing], [Floor], [Furnishing], [IsVerified], [ListingType], [Parking], [RejectReason], [TotalFloors], [UpdatedDate], [ViewCount], [ApprovedPrice]) VALUES (N'4', N'Modern 2 BHK near Hitech City metro', N'Modern 2 BHK near Hitech City metro. 2 BHK apartment in Madhapur, Hyderabad: 1,150 sq ft, furnished, north-east-facing. Close to schools, hospitals and daily needs.', N'Apartment', N'2', N'32000.00', N'1150.00', N'Madhapur', N'Hyderabad', N'/uploads/ph-madhapur-2bhk.webp', N'2', N'Approved', N'2026-11-12T09:40:32.220', NULL, N'1.744830000000000e+001', N'7.839149999999999e+001', N'["Fitness Centre","Security","Parking","Power Backup"]', N'2', N'2026-11-12T13:40:32.2205038', N'2', N'Ready to move', N'North-East', N'5', N'Furnished', N'1', N'Rent', N'1', NULL, N'12', N'2026-11-18T09:40:32.2205038', N'1', N'32000.00');
INSERT INTO dbo.[Properties] ([PropertyId], [Title], [Description], [PropertyType], [BHK], [Price], [Area], [Location], [City], [ImageUrl], [OwnerId], [Status], [CreatedDate], [Badge], [Latitude], [Longitude], [LifestyleFeatures], [AgeYears], [ApprovedDate], [Bathrooms], [ConstructionStatus], [Facing], [Floor], [Furnishing], [IsVerified], [ListingType], [Parking], [RejectReason], [TotalFloors], [UpdatedDate], [ViewCount], [ApprovedPrice]) VALUES (N'5', N'Luxury 4 BHK villa in gated community', N'Luxury 4 BHK villa in gated community. 4 BHK villa in Gachibowli, Hyderabad: 4,200 sq ft, furnished, north-facing. Close to schools, hospitals and daily needs.', N'Villa', N'4', N'38500000.00', N'4200.00', N'Gachibowli', N'Hyderabad', N'/uploads/ph-gachibowli-villa.webp', N'2', N'Approved', N'2026-11-09T09:40:32.220', N'PREMIUM', N'1.744010000000000e+001', N'7.834890000000000e+001', N'["Swimming Pool","Clubhouse","Security","Parking","Garden"]', N'1', N'2026-11-09T13:40:32.2205038', N'5', N'Ready to move', N'North', N'0', N'Furnished', N'1', N'Sale', N'3', NULL, N'2', N'2026-11-18T09:40:32.2205038', N'0', N'38500000.00');
INSERT INTO dbo.[Properties] ([PropertyId], [Title], [Description], [PropertyType], [BHK], [Price], [Area], [Location], [City], [ImageUrl], [OwnerId], [Status], [CreatedDate], [Badge], [Latitude], [Longitude], [LifestyleFeatures], [AgeYears], [ApprovedDate], [Bathrooms], [ConstructionStatus], [Facing], [Floor], [Furnishing], [IsVerified], [ListingType], [Parking], [RejectReason], [TotalFloors], [UpdatedDate], [ViewCount], [ApprovedPrice]) VALUES (N'6', N'Independent 3 BHK house with garden', N'Independent 3 BHK house with garden. 3 BHK house in Benz Circle, Vijayawada: 2,100 sq ft, unfurnished, east-facing. Close to schools, hospitals and daily needs.', N'House', N'3', N'9800000.00', N'2100.00', N'Benz Circle', N'Vijayawada', N'/uploads/ph-benz-circle-house.webp', N'4', N'Approved', N'2026-11-06T09:40:32.220', NULL, N'1.649960000000000e+001', N'8.065600000000001e+001', N'["Garden","Parking","Security"]', N'6', N'2026-11-06T13:40:32.2205038', N'3', N'Ready to move', N'East', N'0', N'Unfurnished', N'0', N'Sale', N'2', NULL, N'2', N'2026-11-18T09:40:32.2205038', N'0', N'9800000.00');
INSERT INTO dbo.[Properties] ([PropertyId], [Title], [Description], [PropertyType], [BHK], [Price], [Area], [Location], [City], [ImageUrl], [OwnerId], [Status], [CreatedDate], [Badge], [Latitude], [Longitude], [LifestyleFeatures], [AgeYears], [ApprovedDate], [Bathrooms], [ConstructionStatus], [Facing], [Floor], [Furnishing], [IsVerified], [ListingType], [Parking], [RejectReason], [TotalFloors], [UpdatedDate], [ViewCount], [ApprovedPrice]) VALUES (N'7', N'Sea-facing 3 BHK on Beach Road', N'Sea-facing 3 BHK on Beach Road. 3 BHK apartment in Beach Road, Visakhapatnam: 1,720 sq ft, semi-furnished, south-east-facing. Close to schools, hospitals and daily needs.', N'Apartment', N'3', N'14200000.00', N'1720.00', N'Beach Road', N'Visakhapatnam', N'/uploads/ph-beach-road-3bhk.webp', N'4', N'Approved', N'2026-11-03T09:40:32.220', N'HOT PROPERTY', N'1.772150000000000e+001', N'8.333499999999999e+001', N'["Swimming Pool","Fitness Centre","Security","Parking"]', N'4', N'2026-11-03T13:40:32.2205038', N'3', N'Ready to move', N'South-East', N'11', N'Semi-furnished', N'1', N'Sale', N'1', NULL, N'15', N'2026-11-18T09:40:32.2205038', N'0', N'14200000.00');
INSERT INTO dbo.[Properties] ([PropertyId], [Title], [Description], [PropertyType], [BHK], [Price], [Area], [Location], [City], [ImageUrl], [OwnerId], [Status], [CreatedDate], [Badge], [Latitude], [Longitude], [LifestyleFeatures], [AgeYears], [ApprovedDate], [Bathrooms], [ConstructionStatus], [Facing], [Floor], [Furnishing], [IsVerified], [ListingType], [Parking], [RejectReason], [TotalFloors], [UpdatedDate], [ViewCount], [ApprovedPrice]) VALUES (N'8', N'Affordable 2 BHK for families', N'Affordable 2 BHK for families. 2 BHK apartment in MVP Colony, Visakhapatnam: 1,050 sq ft, semi-furnished, west-facing. Close to schools, hospitals and daily needs.', N'Apartment', N'2', N'14500.00', N'1050.00', N'MVP Colony', N'Visakhapatnam', N'/uploads/ph-mvp-colony-2bhk.webp', N'4', N'Approved', N'2026-10-31T09:40:32.220', NULL, N'1.774000000000000e+001', N'8.333600000000000e+001', N'["Security","Parking","Children\u0027s Play Area"]', N'8', N'2026-10-31T13:40:32.2205038', N'2', N'Ready to move', N'West', N'2', N'Semi-furnished', N'0', N'Rent', N'1', NULL, N'5', N'2026-11-18T09:40:32.2205038', N'0', N'14500.00');
INSERT INTO dbo.[Properties] ([PropertyId], [Title], [Description], [PropertyType], [BHK], [Price], [Area], [Location], [City], [ImageUrl], [OwnerId], [Status], [CreatedDate], [Badge], [Latitude], [Longitude], [LifestyleFeatures], [AgeYears], [ApprovedDate], [Bathrooms], [ConstructionStatus], [Facing], [Floor], [Furnishing], [IsVerified], [ListingType], [Parking], [RejectReason], [TotalFloors], [UpdatedDate], [ViewCount], [ApprovedPrice]) VALUES (N'9', N'Under-construction 3 BHK in Amaravati', N'Under-construction 3 BHK in Amaravati. 3 BHK apartment in Tullur, Amaravati: 1,480 sq ft, unfurnished, north-east-facing. Close to schools, hospitals and daily needs.', N'Apartment', N'3', N'7200000.00', N'1480.00', N'Tullur', N'Amaravati', N'/uploads/ph-amaravati-3bhk.webp', N'4', N'Approved', N'2026-10-28T09:40:32.220', N'NEW', N'1.650620000000000e+001', N'8.051500000000000e+001', N'["Clubhouse","Swimming Pool","Parking"]', N'0', N'2026-10-28T13:40:32.2205038', N'2', N'Under construction', N'North-East', N'6', N'Unfurnished', N'0', N'Sale', N'1', NULL, N'14', N'2026-11-18T09:40:32.2205038', N'0', N'7200000.00');
INSERT INTO dbo.[Properties] ([PropertyId], [Title], [Description], [PropertyType], [BHK], [Price], [Area], [Location], [City], [ImageUrl], [OwnerId], [Status], [CreatedDate], [Badge], [Latitude], [Longitude], [LifestyleFeatures], [AgeYears], [ApprovedDate], [Bathrooms], [ConstructionStatus], [Facing], [Floor], [Furnishing], [IsVerified], [ListingType], [Parking], [RejectReason], [TotalFloors], [UpdatedDate], [ViewCount], [ApprovedPrice]) VALUES (N'10', N'Cosy 1 BHK near Whitefield IT park', N'Cosy 1 BHK near Whitefield IT park. 1 BHK apartment in Whitefield, Bengaluru: 650 sq ft, furnished, north-facing. Close to schools, hospitals and daily needs.', N'Apartment', N'1', N'18000.00', N'650.00', N'Whitefield', N'Bengaluru', N'/uploads/ph-whitefield-1bhk.webp', N'6', N'Approved', N'2026-10-25T09:40:32.220', NULL, N'1.296980000000000e+001', N'7.775000000000000e+001', N'["Fitness Centre","Security","Power Backup"]', N'5', N'2026-10-25T13:40:32.2205038', N'1', N'Ready to move', N'North', N'3', N'Furnished', N'1', N'Rent', N'1', NULL, N'8', N'2026-11-18T09:40:32.2205038', N'0', N'18000.00');
INSERT INTO dbo.[Properties] ([PropertyId], [Title], [Description], [PropertyType], [BHK], [Price], [Area], [Location], [City], [ImageUrl], [OwnerId], [Status], [CreatedDate], [Badge], [Latitude], [Longitude], [LifestyleFeatures], [AgeYears], [ApprovedDate], [Bathrooms], [ConstructionStatus], [Facing], [Floor], [Furnishing], [IsVerified], [ListingType], [Parking], [RejectReason], [TotalFloors], [UpdatedDate], [ViewCount], [ApprovedPrice]) VALUES (N'11', N'Heritage stone cottage with large plot', N'Heritage stone cottage with large plot. 2 BHK house in Jubilee Hills, Hyderabad: 1,600 sq ft, semi-furnished, south-facing. Close to schools, hospitals and daily needs.', N'House', N'2', N'8900000.00', N'1600.00', N'Jubilee Hills', N'Hyderabad', N'/uploads/ph-jubilee-cottage.webp', N'6', N'Approved', N'2026-10-22T09:40:32.220', NULL, N'1.743260000000000e+001', N'7.840710000000000e+001', N'["Garden","Parking"]', N'25', N'2026-10-22T13:40:32.2205038', N'2', N'Ready to move', N'South', N'0', N'Semi-furnished', N'0', N'Sale', N'2', NULL, N'1', N'2026-11-18T09:40:32.2205038', N'0', N'8900000.00');
INSERT INTO dbo.[Properties] ([PropertyId], [Title], [Description], [PropertyType], [BHK], [Price], [Area], [Location], [City], [ImageUrl], [OwnerId], [Status], [CreatedDate], [Badge], [Latitude], [Longitude], [LifestyleFeatures], [AgeYears], [ApprovedDate], [Bathrooms], [ConstructionStatus], [Facing], [Floor], [Furnishing], [IsVerified], [ListingType], [Parking], [RejectReason], [TotalFloors], [UpdatedDate], [ViewCount], [ApprovedPrice]) VALUES (N'12', N'Premium 4 BHK villa with private pool', N'Premium 4 BHK villa with private pool. 4 BHK villa in Sarjapur Road, Bengaluru: 5,200 sq ft, furnished, east-facing. Close to schools, hospitals and daily needs.', N'Villa', N'4', N'52000000.00', N'5200.00', N'Sarjapur Road', N'Bengaluru', N'/uploads/ph-sarjapur-villa.webp', N'6', N'Approved', N'2026-10-19T09:40:32.220', N'PREMIUM', N'1.291000000000000e+001', N'7.768700000000000e+001', N'["Swimming Pool","Garden","Security","Parking","Clubhouse"]', N'2', N'2026-10-19T13:40:32.2205038', N'4', N'Ready to move', N'East', N'0', N'Furnished', N'1', N'Sale', N'4', NULL, N'3', N'2026-11-18T09:40:32.2205038', N'0', N'52000000.00');
INSERT INTO dbo.[Properties] ([PropertyId], [Title], [Description], [PropertyType], [BHK], [Price], [Area], [Location], [City], [ImageUrl], [OwnerId], [Status], [CreatedDate], [Badge], [Latitude], [Longitude], [LifestyleFeatures], [AgeYears], [ApprovedDate], [Bathrooms], [ConstructionStatus], [Facing], [Floor], [Furnishing], [IsVerified], [ListingType], [Parking], [RejectReason], [TotalFloors], [UpdatedDate], [ViewCount], [ApprovedPrice]) VALUES (N'13', N'2 BHK duplex near Kukatpally metro', N'2 BHK duplex awaiting approval. 2 BHK house in Kukatpally, Hyderabad: 1,250 sq ft, unfurnished, west-facing. Close to schools, hospitals and daily needs.', N'House', N'2', N'6400000.00', N'1250.00', N'Kukatpally', N'Hyderabad', N'/uploads/ph-kukatpally-duplex.webp', N'6', N'Pending', N'2026-10-16T09:40:32.220', NULL, N'1.749480000000000e+001', N'7.839960000000001e+001', N'["Parking"]', N'10', NULL, N'2', N'Ready to move', N'West', N'0', N'Unfurnished', N'0', N'Sale', N'1', NULL, N'2', NULL, N'0', NULL);
INSERT INTO dbo.[Properties] ([PropertyId], [Title], [Description], [PropertyType], [BHK], [Price], [Area], [Location], [City], [ImageUrl], [OwnerId], [Status], [CreatedDate], [Badge], [Latitude], [Longitude], [LifestyleFeatures], [AgeYears], [ApprovedDate], [Bathrooms], [ConstructionStatus], [Facing], [Floor], [Furnishing], [IsVerified], [ListingType], [Parking], [RejectReason], [TotalFloors], [UpdatedDate], [ViewCount], [ApprovedPrice]) VALUES (N'14', N'Furnished studio near Ameerpet metro', N'Studio flat (needs better photos). 1 BHK apartment in Ameerpet, Hyderabad: 420 sq ft, furnished, north-facing. Close to schools, hospitals and daily needs.', N'Apartment', N'1', N'9000.00', N'420.00', N'Ameerpet', N'Hyderabad', N'/uploads/ph-ameerpet-studio.webp', N'2', N'Rejected', N'2026-10-13T09:40:32.220', NULL, N'1.743750000000000e+001', N'7.844830000000000e+001', N'["Security"]', N'12', NULL, N'1', N'Ready to move', N'North', N'1', N'Furnished', N'0', N'Rent', N'0', N'Please add clear photos of the kitchen and bathroom.', N'4', NULL, N'0', NULL);
INSERT INTO dbo.[Properties] ([PropertyId], [Title], [Description], [PropertyType], [BHK], [Price], [Area], [Location], [City], [ImageUrl], [OwnerId], [Status], [CreatedDate], [Badge], [Latitude], [Longitude], [LifestyleFeatures], [AgeYears], [ApprovedDate], [Bathrooms], [ConstructionStatus], [Facing], [Floor], [Furnishing], [IsVerified], [ListingType], [Parking], [RejectReason], [TotalFloors], [UpdatedDate], [ViewCount], [ApprovedPrice]) VALUES (N'15', N'Residential plot in Brodipet', N'Draft: plot listing in Guntur. 0 BHK plot in Brodipet, Guntur: 2,400 sq ft, unfurnished, east-facing. Close to schools, hospitals and daily needs.', N'Plot', N'0', N'3500000.00', N'2400.00', N'Brodipet', N'Guntur', N'/uploads/ph-brodipet-plot.webp', N'4', N'Draft', N'2026-10-10T09:40:32.220', NULL, N'1.630670000000000e+001', N'8.043650000000000e+001', N'[]', N'0', NULL, N'0', N'Ready to move', N'East', N'0', N'Unfurnished', N'0', N'Sale', N'0', NULL, N'0', NULL, N'0', NULL);
SET IDENTITY_INSERT dbo.[Properties] OFF;
GO

-- PropertyImages
SET IDENTITY_INSERT dbo.[PropertyImages] ON;
INSERT INTO dbo.[PropertyImages] ([PropertyImageId], [PropertyId], [ImageUrl], [CreatedDate]) VALUES (N'1', N'3', N'/uploads/ph-int-living.webp', N'2026-11-19T02:08:06.1014490');
INSERT INTO dbo.[PropertyImages] ([PropertyImageId], [PropertyId], [ImageUrl], [CreatedDate]) VALUES (N'2', N'3', N'/uploads/ph-int-kitchen.webp', N'2026-11-19T02:08:06.1014490');
INSERT INTO dbo.[PropertyImages] ([PropertyImageId], [PropertyId], [ImageUrl], [CreatedDate]) VALUES (N'3', N'3', N'/uploads/ph-int-bedroom.webp', N'2026-11-19T02:08:06.1014490');
INSERT INTO dbo.[PropertyImages] ([PropertyImageId], [PropertyId], [ImageUrl], [CreatedDate]) VALUES (N'4', N'3', N'/uploads/ph-int-bath.webp', N'2026-11-19T02:08:06.1014490');
INSERT INTO dbo.[PropertyImages] ([PropertyImageId], [PropertyId], [ImageUrl], [CreatedDate]) VALUES (N'5', N'4', N'/uploads/ph-int-kitchen.webp', N'2026-11-19T02:08:06.1014490');
INSERT INTO dbo.[PropertyImages] ([PropertyImageId], [PropertyId], [ImageUrl], [CreatedDate]) VALUES (N'6', N'4', N'/uploads/ph-int-bath.webp', N'2026-11-19T02:08:06.1014490');
INSERT INTO dbo.[PropertyImages] ([PropertyImageId], [PropertyId], [ImageUrl], [CreatedDate]) VALUES (N'7', N'5', N'/uploads/ph-ext-pool.webp', N'2026-11-19T02:08:06.1014490');
INSERT INTO dbo.[PropertyImages] ([PropertyImageId], [PropertyId], [ImageUrl], [CreatedDate]) VALUES (N'8', N'5', N'/uploads/ph-int-living2.webp', N'2026-11-19T02:08:06.1014490');
INSERT INTO dbo.[PropertyImages] ([PropertyImageId], [PropertyId], [ImageUrl], [CreatedDate]) VALUES (N'9', N'5', N'/uploads/ph-int-bedroom.webp', N'2026-11-19T02:08:06.1014490');
INSERT INTO dbo.[PropertyImages] ([PropertyImageId], [PropertyId], [ImageUrl], [CreatedDate]) VALUES (N'10', N'7', N'/uploads/ph-int-living2.webp', N'2026-11-19T02:08:06.1014490');
INSERT INTO dbo.[PropertyImages] ([PropertyImageId], [PropertyId], [ImageUrl], [CreatedDate]) VALUES (N'11', N'7', N'/uploads/ph-int-bedroom.webp', N'2026-11-19T02:08:06.1014490');
INSERT INTO dbo.[PropertyImages] ([PropertyImageId], [PropertyId], [ImageUrl], [CreatedDate]) VALUES (N'12', N'12', N'/uploads/ph-int-living.webp', N'2026-11-19T02:08:06.1014490');
INSERT INTO dbo.[PropertyImages] ([PropertyImageId], [PropertyId], [ImageUrl], [CreatedDate]) VALUES (N'13', N'12', N'/uploads/ph-int-kitchen.webp', N'2026-11-19T02:08:06.1014490');
SET IDENTITY_INSERT dbo.[PropertyImages] OFF;
GO

-- Inquiries
SET IDENTITY_INSERT dbo.[Inquiries] ON;
INSERT INTO dbo.[Inquiries] ([InquiryId], [PropertyId], [BuyerId], [OwnerId], [Message], [Status], [CreatedDate], [OwnerReply], [RespondedDate]) VALUES (N'1', N'3', N'3', N'2', N'Is the price negotiable? Is covered parking included?', N'Responded', N'2026-11-18T09:46:32.237', N'Yes, slightly negotiable. One covered parking slot is included.', N'2026-11-18T09:47:37.5483219');
SET IDENTITY_INSERT dbo.[Inquiries] OFF;
GO

-- Favorites
SET IDENTITY_INSERT dbo.[Favorites] ON;
SET IDENTITY_INSERT dbo.[Favorites] OFF;
GO

-- UserProfiles
SET IDENTITY_INSERT dbo.[UserProfiles] ON;
SET IDENTITY_INSERT dbo.[UserProfiles] OFF;
GO

-- PropertyReviews
SET IDENTITY_INSERT dbo.[PropertyReviews] ON;
SET IDENTITY_INSERT dbo.[PropertyReviews] OFF;
GO

-- SiteVisits
SET IDENTITY_INSERT dbo.[SiteVisits] ON;
INSERT INTO dbo.[SiteVisits] ([SiteVisitId], [PropertyId], [BuyerId], [OwnerId], [ScheduledAt], [Status], [Note], [ReminderSent], [CreatedDate], [UpdatedDate]) VALUES (N'1', N'3', N'3', N'2', N'2026-11-21T10:30:00', N'Accepted', NULL, N'0', N'2026-11-18T09:46:34.2816539', N'2026-11-18T09:48:21.6283216');
SET IDENTITY_INSERT dbo.[SiteVisits] OFF;
GO

-- SavedSearches
SET IDENTITY_INSERT dbo.[SavedSearches] ON;
INSERT INTO dbo.[SavedSearches] ([SavedSearchId], [UserId], [Name], [Query], [AlertsEnabled], [CreatedDate], [LastAlertDate]) VALUES (N'1', N'5', N'2 BHK for rent in Hyderabad', N'type=rent&city=Hyderabad&bhk=2', N'1', N'2026-11-18T10:19:22.7765665', N'2026-11-18T10:19:31.3897609');
SET IDENTITY_INSERT dbo.[SavedSearches] OFF;
GO

-- Notifications
SET IDENTITY_INSERT dbo.[Notifications] ON;
INSERT INTO dbo.[Notifications] ([NotificationId], [UserId], [Title], [Message], [Type], [IsRead], [RelatedPropertyId], [CreatedDate]) VALUES (N'8', N'2', N'New inquiry', N'Venkat asked about ''Spacious 3 BHK with lake view in Kondapur'': "Is the price negotiable? Is covered parking included?"', N'InquiryReceived', N'0', N'3', N'2026-11-18T09:46:32.2697377');
INSERT INTO dbo.[Notifications] ([NotificationId], [UserId], [Title], [Message], [Type], [IsRead], [RelatedPropertyId], [CreatedDate]) VALUES (N'9', N'2', N'New site visit request', N'Venkat wants to visit ''Spacious 3 BHK with lake view in Kondapur'' on Fri 20 Nov 2026, 11:00 AM IST. Accept or suggest another time.', N'SiteVisitRequested', N'0', N'3', N'2026-11-18T09:46:34.3035905');
INSERT INTO dbo.[Notifications] ([NotificationId], [UserId], [Title], [Message], [Type], [IsRead], [RelatedPropertyId], [CreatedDate]) VALUES (N'10', N'3', N'The owner replied', N'Reply about ''Spacious 3 BHK with lake view in Kondapur'': "Yes, slightly negotiable. One covered parking slot is included."', N'InquiryResponded', N'0', N'3', N'2026-11-18T09:47:37.5563901');
INSERT INTO dbo.[Notifications] ([NotificationId], [UserId], [Title], [Message], [Type], [IsRead], [RelatedPropertyId], [CreatedDate]) VALUES (N'11', N'3', N'New time suggested for your visit', N'The owner of ''Spacious 3 BHK with lake view in Kondapur'' suggested Sat 21 Nov 2026, 4:00 PM IST. Accept it or cancel the visit.', N'SiteVisitRescheduled', N'0', N'3', N'2026-11-18T09:48:02.2460951');
INSERT INTO dbo.[Notifications] ([NotificationId], [UserId], [Title], [Message], [Type], [IsRead], [RelatedPropertyId], [CreatedDate]) VALUES (N'12', N'2', N'Site visit confirmed', N'Your visit to ''Spacious 3 BHK with lake view in Kondapur'' is confirmed for Sat 21 Nov 2026, 4:00 PM IST.', N'SiteVisitAccepted', N'0', N'3', N'2026-11-18T09:48:21.6322062');
SET IDENTITY_INSERT dbo.[Notifications] OFF;
GO

-- ContactRequests
SET IDENTITY_INSERT dbo.[ContactRequests] ON;
SET IDENTITY_INSERT dbo.[ContactRequests] OFF;
GO

-- PropertyViewsDaily
INSERT INTO dbo.[PropertyViewsDaily] ([PropertyId], [Day], [Views]) VALUES (N'3', N'2026-11-18', N'3');
INSERT INTO dbo.[PropertyViewsDaily] ([PropertyId], [Day], [Views]) VALUES (N'3', N'2026-11-19', N'4');
INSERT INTO dbo.[PropertyViewsDaily] ([PropertyId], [Day], [Views]) VALUES (N'4', N'2026-11-18', N'1');
GO
