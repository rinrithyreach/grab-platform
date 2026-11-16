# SQL Server schema

```mermaid
erDiagram
    Users ||--o| Drivers : "has driver profile"
    Users ||--o| Merchants : "has merchant profile"
    Merchants ||--o{ MerchantImages : uploads
    Merchants ||--o{ MerchantListings : publishes
    MerchantImages ||--o{ MerchantListings : illustrates
    Users ||--o{ Rides : "books as customer"
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
```

DriverId and CompletedAt in Rides, driver coordinates, and review Comment are nullable. Foreign keys use restricted deletes. Payment/review uniqueness is enforced in SQL as well as the service. Rating has a SQL CHECK constraint. Customer/date and driver/status compound indexes support history and assigned ride queries. Money is decimal(12,2), development fare currency USD.

PhoneNumber is normalized and unique and is the sign-in identifier. Email is nullable, retained for legacy records, and has a filtered unique index for non-null values. New phone-only accounts have no email; their password remains hashed.

Merchant profile email is an optional public business contact, separate from the legacy Users.Email column. Merchant services are stored as GrabRide, GrabFood or GrabExpress. The public DTO omits OwnerName and UserId. Merchant listings have a positive-price CHECK constraint and decimal(12,2) USD prices. Service checks ensure the attached image belongs to the listing's merchant. Only published listings enter public feeds and storefronts; only published featured listings enter homepage banners. The MerchantPublishing migration adds these three tables.

The RideMerchantDetails migration adds nullable MotorcycleLicensePlate (maximum 30 characters). GrabRide registration/profile saves require this value, and public DTOs omit it. GrabRide uses OwnerName as its public BusinessName and Address as the rider's location; other business fields need not be supplied.
