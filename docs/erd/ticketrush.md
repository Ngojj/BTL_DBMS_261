# TicketRush ERD

```mermaid
erDiagram
    USERS ||--o{ ORDERS : places
    GENRES ||--o{ EVENTS : classifies
    VENUES ||--o{ EVENTS : hosts
    EVENTS ||--o{ ZONES : contains
    EVENTS ||--o{ ORDERS : receives
    ZONES ||--o{ SEATS : contains
    ORDERS ||--o{ TICKETS : includes
    SEATS ||--o{ TICKETS : assigned
    ORDERS ||--o{ PAYMENTS : records
    USERS ||--o{ REVIEWS : writes
    EVENTS ||--o{ REVIEWS : receives
    USERS o|--o{ SEATS : holds

    USERS {
        bigint user_id PK
        varchar email UK
        varchar phone
        varchar full_name
        text password_hash
        user_role role
        timestamptz created_at
    }
    GENRES {
        int genre_id PK
        varchar name UK
    }
    VENUES {
        int venue_id PK
        varchar name
        varchar city
        varchar address
    }
    EVENTS {
        bigint event_id PK
        varchar title
        int genre_id FK
        int venue_id FK
        timestamptz event_date
        timestamptz sale_open_at
        smallint max_tickets_per_user
        event_status status
    }
    ZONES {
        bigint zone_id PK
        bigint event_id FK
        varchar name
        numeric price
        int capacity
    }
    SEATS {
        bigint seat_id PK
        bigint zone_id FK
        varchar row_label
        smallint seat_no
        seat_status status
        bigint held_by FK
        timestamptz held_until
        int version
    }
    ORDERS {
        bigint order_id PK
        bigint user_id FK
        bigint event_id FK
        numeric total
        order_status status
        timestamptz created_at
        timestamptz expires_at
    }
    TICKETS {
        bigint ticket_id PK
        bigint order_id FK
        bigint seat_id FK
        numeric price
        uuid qr_code UK
        ticket_status status
        timestamptz checked_in_at
    }
    PAYMENTS {
        bigint payment_id PK
        bigint order_id FK
        numeric amount
        payment_method method
        payment_status status
        timestamptz paid_at
    }
    REVIEWS {
        bigint review_id PK
        bigint user_id FK
        bigint event_id FK
        smallint rating
        text comment
        timestamptz created_at
    }
```

Schema/ERD ghi nhận toàn bộ các bảng trong `database/schema.sql`; một số bảng như `reviews` và các trường QR/check-in nằm ngoài chức năng tuần 42.

## Ràng buộc giao dịch vé

- `UNIQUE (event_id, name)` ngăn trùng tên khu vực trong cùng sự kiện.
- `UNIQUE (zone_id, row_label, seat_no)` định danh vị trí ghế.
- Partial unique index `uq_active_ticket_per_seat` chỉ cho một vé chưa hủy trên mỗi ghế.
- Trigger `ticket_rules` kiểm tra ghế thuộc đúng event và giới hạn số vé trên event.
- `chk_hold` buộc ghế `HELD` có `held_by` và `held_until`.
- `uq_success_payment_per_order` giới hạn một payment thành công cho mỗi order.

`database/schema.sql` là script tạo schema PostgreSQL. Script có `DROP TABLE ... CASCADE`; chỉ chạy trên database mới hoặc chấp nhận xóa dữ liệu.
