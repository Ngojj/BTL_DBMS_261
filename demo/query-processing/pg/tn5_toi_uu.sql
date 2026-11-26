-- TN5 – Bộ tối ưu tự động: cách viết, thứ tự kết, tự viết lại truy vấn
\i /tmp/qp/00_phien.sql
\echo
\echo '===== TN5a. Ba cách viết Q_DT tương đương -> cùng MỘT kế hoạch ====='
\echo '--- (1) Liệt kê bảng trong FROM, điều kiện kết ở WHERE ---'
EXPLAIN (COSTS OFF) SELECT z.name, count(*), sum(t.price) FROM tickets t, seats s, zones z
 WHERE t.seat_id = s.seat_id AND s.zone_id = z.zone_id AND z.event_id = 5 AND t.status <> 'CANCELLED' GROUP BY z.name;
\echo '--- (2) JOIN ... ON ---'
EXPLAIN (COSTS OFF) SELECT z.name, count(*), sum(t.price) FROM zones z JOIN seats s ON s.zone_id = z.zone_id
 JOIN tickets t ON t.seat_id = s.seat_id WHERE z.event_id = 5 AND t.status <> 'CANCELLED' GROUP BY z.name;
\echo '--- (3) Lọc bên ngoài truy vấn con ---'
EXPLAIN (COSTS OFF) SELECT name, count(*), sum(price) FROM (SELECT z.name, z.event_id, t.price, t.status
 FROM tickets t JOIN seats s ON t.seat_id = s.seat_id JOIN zones z ON s.zone_id = z.zone_id) x
 WHERE event_id = 5 AND status <> 'CANCELLED' GROUP BY name;

\prompt '>> Enter: TN5b – thứ tự kết: để bộ tối ưu tự chọn so với ép theo thứ tự viết tay ' _
\set q 'SELECT u.full_name, e.title, t.qr_code FROM users u JOIN orders o ON o.user_id = u.user_id JOIN tickets t ON t.order_id = o.order_id JOIN events e ON e.event_id = o.event_id WHERE e.title = ''Sự kiện 77'''
\echo '--- Tự chọn thứ tự (bắt đầu từ events lọc theo title) ---'
EXPLAIN (ANALYZE, TIMING OFF) :q;
\echo '--- join_collapse_limit = 1: kết đúng thứ tự đã viết (users trước) ---'
BEGIN; SET LOCAL join_collapse_limit = 1; EXPLAIN (ANALYZE, TIMING OFF) :q; ROLLBACK;

\prompt '>> Enter: TN5c – bộ tối ưu tự viết lại truy vấn ' _
\echo '--- LEFT JOIN thừa (không lấy cột nào của seats, seat_id là khóa) -> bị bỏ ---'
EXPLAIN (ANALYZE, TIMING OFF) SELECT t.ticket_id, t.price FROM tickets t LEFT JOIN seats s ON s.seat_id = t.seat_id WHERE t.order_id < 1000;
\echo '--- Có lấy cột của seats -> phải kết ---'
EXPLAIN (ANALYZE, TIMING OFF) SELECT t.ticket_id, t.price, s.row_label FROM tickets t LEFT JOIN seats s ON s.seat_id = t.seat_id WHERE t.order_id < 1000;
\echo '--- Ràng buộc CHECK (rating 1..5): rating > 5 trả rỗng không cần đọc bảng ---'
BEGIN; SET LOCAL constraint_exclusion = on; EXPLAIN (ANALYZE, TIMING OFF) SELECT * FROM reviews WHERE rating > 5; ROLLBACK;
\echo '--- Dừng sớm với LIMIT 10 (pipelining) so với lấy hết ---'
EXPLAIN (ANALYZE, TIMING OFF) SELECT o.order_id, t.qr_code FROM orders o JOIN tickets t ON t.order_id = o.order_id WHERE o.status = 'PAID' ORDER BY o.order_id LIMIT 10;
EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF) SELECT o.order_id, t.qr_code FROM orders o JOIN tickets t ON t.order_id = o.order_id WHERE o.status = 'PAID' ORDER BY o.order_id;
