# SQL Server schema

```mermaid
erDiagram
    Users ||--o| Drivers : "has driver profile"
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
        nvarchar PhoneNumber
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
```

DriverId and CompletedAt in Rides, driver coordinates, and review Comment are nullable. Foreign keys use restricted deletes. Payment/review uniqueness is enforced in SQL as well as the service. Rating has a SQL CHECK constraint. Customer/date and driver/status compound indexes support history and assigned ride queries. Money is decimal(12,2), development fare currency USD.
