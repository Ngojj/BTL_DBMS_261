-- TN3 – Gom nhóm: báo cáo doanh thu theo khu vực (Q_DT) của sự kiện 1 (~1.000 vé) và 5 (~50.000 vé)
\i /tmp/qp/00_phien.sql
\echo
\echo '===== TN3. Q_DT: một câu SQL JOIN 3 bảng + GROUP BY ====='
\echo '--- Sự kiện 1 ---'
SELECT z.name AS khu, count(*) AS so_ve, sum(t.price) AS doanh_thu
  FROM zones z JOIN seats s ON s.zone_id = z.zone_id JOIN tickets t ON t.seat_id = s.seat_id
 WHERE z.event_id = 1 AND t.status <> 'CANCELLED' GROUP BY z.name ORDER BY z.name;
EXPLAIN (ANALYZE, BUFFERS)
SELECT z.name, count(*), sum(t.price)
  FROM zones z JOIN seats s ON s.zone_id = z.zone_id JOIN tickets t ON t.seat_id = s.seat_id
 WHERE z.event_id = 1 AND t.status <> 'CANCELLED' GROUP BY z.name;
\prompt '>> Enter: cùng câu hỏi cho sự kiện 5 (~50.000 vé) ' _
SELECT z.name AS khu, count(*) AS so_ve, sum(t.price) AS doanh_thu
  FROM zones z JOIN seats s ON s.zone_id = z.zone_id JOIN tickets t ON t.seat_id = s.seat_id
 WHERE z.event_id = 5 AND t.status <> 'CANCELLED' GROUP BY z.name ORDER BY z.name;
EXPLAIN (ANALYZE, BUFFERS)
SELECT z.name, count(*), sum(t.price)
  FROM zones z JOIN seats s ON s.zone_id = z.zone_id JOIN tickets t ON t.seat_id = s.seat_id
 WHERE z.event_id = 5 AND t.status <> 'CANCELLED' GROUP BY z.name;
\echo '-> Cùng một câu SQL cho mọi quy mô; bộ tối ưu tự chọn kế hoạch. So sánh với Firestore: node demo.mjs tn3'
