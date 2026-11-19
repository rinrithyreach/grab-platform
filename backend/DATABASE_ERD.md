# SQL Server schema

```mermaid
erDiagram
    Users ||--o| Drivers : "has driver profile"
    Users ||--o| Merchants : "has merchant profile"
    Users ||--o| AccountData : "private synchronized demo state"
    Merchants ||--o{ MerchantImages : uploads
    Merchants ||--o{ MerchantListings : publishes
    MerchantImages ||--o{ MerchantListings : illustrates
    Users ||--o{ Rides : "books as customer"
    Users ||--o{ ParcelDeliveries : "books parcels"
    Merchants o|--o{ ParcelDeliveries : "courier assignment"
    ParcelDeliveries ||--|{ DeliveryStops : "ordered drop-offs"
    Drivers o|--o{ Rides : "assigned to"
    Rides ||--o| Payments : "simulated payment"
    Rides ||--o| Reviews : "reviewed once"
    Users ||--o{ Reviews : writes
    Drivers ||--o{ Reviews : receives
    Users {
        uniqueidentifier Id PK
        nvarchar FullName
        nvarchar Email UK
        nvarchar PasswordHash
        nvarchar PhoneNumber UK
        nvarchar Role
        datetimeoffset CreatedAt
    }
    Drivers {
        uniqueidentifier Id PK
        uniqueidentifier UserId FK,UK
        nvarchar VehicleType
        nvarchar VehiclePlate UK
        bit IsAvailable
        float CurrentLatitude
        float CurrentLongitude
        rowversion Version
    }
    Rides {
        uniqueidentifier Id PK
        uniqueidentifier CustomerId FK
        uniqueidentifier DriverId FK
        nvarchar PickupLocation
        nvarchar Destination
        float PickupLatitude
        float PickupLongitude
        float DestinationLatitude
        float DestinationLongitude
        decimal Fare
        nvarchar Status
        datetimeoffset CreatedAt
        datetimeoffset CompletedAt
        rowversion Version
    }
    ParcelDeliveries {
        uniqueidentifier Id PK
        uniqueidentifier CustomerId FK
        uniqueidentifier CourierMerchantId FK
        nvarchar ServiceType
        nvarchar VehicleType
        nvarchar Status
        nvarchar PaymentMethod
        nvarchar InsuranceTier
        nvarchar PickupName
        nvarchar PickupPhone
        nvarchar PickupAddress
        float PickupLatitude
        float PickupLongitude
        datetimeoffset ScheduledPickupAt
        decimal TotalFare
        decimal CodAmount
        float DistanceKm
        datetimeoffset CreatedAt
        datetimeoffset UpdatedAt
        rowversion Version
    }
    DeliveryStops {
        uniqueidentifier Id PK
        uniqueidentifier DeliveryId FK
        int Position
        nvarchar RecipientName
        nvarchar RecipientPhone
        nvarchar Address
        float Latitude
        float Longitude
        nvarchar ParcelSize
        decimal WeightKg
        decimal CodAmount
        nvarchar Status
        datetimeoffset DeliveredAt
        uniqueidentifier ProofPhotoId FK
    }
    Payments {
        uniqueidentifier Id PK
        uniqueidentifier RideId FK,UK
        decimal Amount
        nvarchar PaymentMethod
        nvarchar Status
        datetimeoffset CreatedAt
    }
    Reviews {
        uniqueidentifier Id PK
        uniqueidentifier RideId FK,UK
        uniqueidentifier CustomerId FK
        uniqueidentifier DriverId FK
        int Rating
        nvarchar Comment
    }
    Merchants {
        uniqueidentifier Id PK
        uniqueidentifier UserId FK,UK
        nvarchar Service
        nvarchar BusinessName
        nvarchar OwnerName
        nvarchar ContactPhone
        nvarchar Email
        nvarchar Address
        nvarchar City
        nvarchar Category
        nvarchar Description
        nvarchar OpeningHours
        nvarchar MotorcycleLicensePlate
        datetimeoffset CreatedAt
    }
    MerchantImages {
        uniqueidentifier Id PK
        uniqueidentifier MerchantId FK
        nvarchar ContentType
        varbinary Data
    }
    MerchantListings {
        uniqueidentifier Id PK
        uniqueidentifier MerchantId FK
        uniqueidentifier ImageId FK
        nvarchar Title
        nvarchar Description
        decimal Price
        bit IsPublished
        bit ShowInSlideshow
        datetimeoffset UpdatedAt
    }
    AccountData {
        uniqueidentifier UserId PK,FK
        nvarchar Json
        bigint Version
        datetimeoffset UpdatedAt
    }
    SharedStorageIdentities {
        int Id PK
        uniqueidentifier StorageId
    }
```

DriverId and CompletedAt in Rides, driver coordinates, and review Comment are nullable. Foreign keys use restricted deletes. Payment/review uniqueness is enforced in SQL as well as the service. Rating has a SQL CHECK constraint. Customer/date and driver/status compound indexes support history and assigned ride queries. Money is decimal(12,2), development fare currency USD.

PhoneNumber is normalized and unique and is the sign-in identifier. Email is nullable, retained for legacy records, and has a filtered unique index for non-null values. New phone-only accounts have no email; their password remains hashed.

Merchant profile email is an optional public business contact, separate from the legacy Users.Email column. Merchant services are stored as GrabRide, GrabFood or GrabExpress. The public DTO omits OwnerName and UserId. Merchant listings have a positive-price CHECK constraint and decimal(12,2) USD prices. Service checks ensure the attached image belongs to the listing's merchant. Only published listings enter public feeds and storefronts; only published featured listings enter homepage banners. The MerchantPublishing migration adds these three tables.

The RideMerchantDetails migration adds nullable MotorcycleLicensePlate (maximum 30 characters). GrabRide registration/profile saves require this value, and public DTOs omit it. GrabRide uses OwnerName as its public BusinessName and Address as the rider's location; other business fields need not be supplied.

SharedAccountData stores each user's existing demo cart/orders, Express deliveries, wallet, addresses, favourites, reviews and settings as a private JSON snapshot. Version is an EF concurrency token, so concurrent/stale writes return 409 instead of silently replacing data. Snapshots save atomically and cannot target another JWT subject. SharedStorageIdentity creates one public, randomly generated StorageId per initialized database; client PCs can compare it to catch separate database setups. Existing tables and application records are preserved by both additive migrations.

The additive `ParcelDeliveries` migration adds server-authoritative parcel bookings and ordered `DeliveryStops`. Prices, contact snapshots, COD/insurance choices, courier GPS, timestamps and proof-photo references are stored separately from legacy Express demo snapshots. Delivery rowversion prevents double claims; a filtered unique index permits one active delivery per courier merchant. Stop position is unique within each delivery, and SQL checks protect fare totals, weights and COD bounds.
