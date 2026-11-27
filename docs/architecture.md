# Kiến trúc TicketRush

```
[React app] --REST/JSON--> [Express API] --SQL--> [PostgreSQL]  (nguồn dữ liệu chính)
     |                           |
     |                           +--Admin SDK--> [Firestore]    (bản sao phục vụ realtime/offline)
     +--Web SDK (chỉ đọc/lắng nghe)--> [Firestore]
```

Backend: **Route → Controller → Service → Repository** (thư mục `backend/src/modules/<tên>/`).

- Route: khai báo endpoint + middleware (`authenticate`, `authorize`).
- Controller: đọc request, gọi service, trả JSON.
- Service: nghiệp vụ, điều phối transaction, gọi `sync.publisher` sau COMMIT.
- Repository: SQL thuần (pg) hoặc thao tác Firestore. Repository của DBMS Lab tách riêng: `labs/<topic>/{postgres,firestore}.js`.

Nguyên tắc: PostgreSQL là source of truth; Firestore là bản sao; frontend không ghi nghiệp vụ trực tiếp vào Firestore (trừ `checkedIn` của STAFF).
