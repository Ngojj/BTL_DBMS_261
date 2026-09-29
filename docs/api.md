# API (tiền tố /api)

Lỗi: `{ "error": { "code", "message" } }`. Xác thực: `Authorization: Bearer <jwt>`.

| Module | Endpoint | Quyền |
| --- | --- | --- |
| health | GET /health | – |
| auth | POST /auth/register, /auth/login, /auth/firebase-token; GET /auth/me | – / đăng nhập |
| events | GET /events, /events/genres, /events/:id; POST, PUT, DELETE (admin) | – / ADMIN |
| zones | GET,POST /events/:id/zones; PUT,DELETE /zones/:id; POST /zones/:id/generate-seats | – / ADMIN |
| booking | POST /orders; POST /orders/:id/pay, /orders/:id/cancel; GET /orders | CUSTOMER |
| tickets | GET /tickets/mine | CUSTOMER |
| checkin | GET /checkin/events/:id/valid-tickets; POST /checkin/sync | STAFF |
| reports | GET /admin/reports/revenue, /occupancy, /suspicious-accounts | ADMIN |
| reviews | GET,POST /events/:id/reviews; GET /events/:id/reviews/summary | – / CUSTOMER |
| sync | POST /admin/sync/events/:id, /admin/sync/all | ADMIN |
| labs | POST /admin/labs/<topic>/run; GET /admin/labs/<topic>/runs | ADMIN |

Topic: data-storage, indexing, query-processing, transaction, concurrency-control, backup-recovery.
