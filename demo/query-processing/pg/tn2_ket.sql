-- TN2 – Phép kết: màn hình "Vé của tôi" và bốn thuật toán kết
\i /tmp/qp/00_phien.sql
\echo
\echo '===== TN2a. "Vé của tôi": kết orders, tickets, seats, zones, events bằng MỘT câu SQL ====='
SELECT o.user_id AS uid FROM orders o JOIN tickets t USING (order_id)
 WHERE o.event_id <= 5 AND o.status = 'PAID' GROUP BY o.user_id ORDER BY count(*) DESC, o.user_id LIMIT 1 \gset
\echo 'Người dùng có nhiều vé nhất trong 5 sự kiện mẫu: user_id =' :uid
SELECT e.title, z.name AS khu, s.row_label || s.seat_no AS ghe, t.qr_code
  FROM orders o JOIN tickets t ON t.order_id = o.order_id
  JOIN seats s ON s.seat_id = t.seat_id JOIN zones z ON z.zone_id = s.zone_id JOIN events e ON e.event_id = z.event_id
 WHERE o.user_id = :uid AND o.status = 'PAID' AND e.event_id <= 5;
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.title, z.name, s.row_label || s.seat_no, t.qr_code
  FROM orders o JOIN tickets t ON t.order_id = o.order_id
  JOIN seats s ON s.seat_id = t.seat_id JOIN zones z ON z.zone_id = s.zone_id JOIN events e ON e.event_id = z.event_id
 WHERE o.user_id = :uid AND o.status = 'PAID' AND e.event_id <= 5;

\prompt '>> Enter: TN2b – cùng phép kết orders ⋈ tickets của sự kiện nhỏ (79 đơn), ép 4 thuật toán ' _
\set q 'SELECT o.order_id, t.ticket_id, t.price FROM orders o JOIN tickets t ON t.order_id = o.order_id WHERE o.event_id = 146'
\echo '--- Bộ tối ưu tự chọn ---'
EXPLAIN (ANALYZE, TIMING OFF) :q;
\echo '--- Nested Loop KHÔNG dùng chỉ mục (vài giây) ---'
BEGIN; SET LOCAL enable_hashjoin = off; SET LOCAL enable_mergejoin = off; SET LOCAL enable_indexscan = off;
SET LOCAL enable_bitmapscan = off; SET LOCAL enable_indexonlyscan = off; SET LOCAL enable_material = off;
EXPLAIN (ANALYZE, TIMING OFF) :q; ROLLBACK;
\echo '--- Nested Loop tra chỉ mục ---'
BEGIN; SET LOCAL enable_hashjoin = off; SET LOCAL enable_mergejoin = off; EXPLAIN (ANALYZE, TIMING OFF) :q; ROLLBACK;
\echo '--- Merge Join ---'
BEGIN; SET LOCAL enable_hashjoin = off; SET LOCAL enable_nestloop = off; EXPLAIN (ANALYZE, TIMING OFF) :q; ROLLBACK;
\echo '--- Hash Join ---'
BEGIN; SET LOCAL enable_mergejoin = off; SET LOCAL enable_nestloop = off; EXPLAIN (ANALYZE, TIMING OFF) :q; ROLLBACK;

\prompt '>> Enter: TN2c – kết TOÀN BỘ đơn đã thanh toán (232.262 đơn): Hash Join (tự chọn) so với Merge Join ' _
\set q2 'SELECT o.event_id, sum(t.price) FROM orders o JOIN tickets t ON t.order_id = o.order_id WHERE o.status = ''PAID'' GROUP BY o.event_id'
\echo '--- Bộ tối ưu tự chọn ---'
EXPLAIN (ANALYZE, TIMING OFF) :q2;
\echo '--- Ép Merge Join ---'
BEGIN; SET LOCAL enable_hashjoin = off; SET LOCAL enable_nestloop = off; EXPLAIN (ANALYZE, TIMING OFF) :q2; ROLLBACK;
\echo '-> Sự kiện nhỏ: tự chọn Nested Loop tra chỉ mục. Kết toàn bộ: tự chọn Hash Join dù Merge Join nhanh hơn (mô hình chi phí không hoàn hảo).'
