# scripts/

| Script | Người phụ trách | Mục đích |
| --- | --- | --- |
| `seed.js` | TV2 | Sinh dữ liệu mẫu, nạp PostgreSQL + Firestore (`npm run seed`, xem README mục 4 bước 7) |
| `load-test.js` | TV5 | Giả lập tải "giờ G" cho DBMS Lab |
| `backup/` | TV1 | Script pg_dump / restore, Firestore export / import cho thí nghiệm Backup & recovery |

Script import trực tiếp từ `backend/src/config/*` nên chạy được sau khi `npm install` ở `backend/`.
