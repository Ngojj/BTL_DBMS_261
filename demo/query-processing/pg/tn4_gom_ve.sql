-- TN4 – Truy vấn lồng: phát hiện gom vé ở sự kiện 5
\i /tmp/qp/00_phien.sql
\echo
\echo '===== TN4. Số điện thoại dùng cho nhiều tài khoản và mua hơn 4 vé ở cùng sự kiện ====='
SELECT u.phone, count(DISTINCT u.user_id) AS so_tai_khoan, count(t.ticket_id) AS so_ve
  FROM users u JOIN orders o ON o.user_id = u.user_id AND o.status = 'PAID'
  JOIN tickets t ON t.order_id = o.order_id
 WHERE o.event_id = 5
   AND u.phone IN (SELECT phone FROM users GROUP BY phone HAVING count(*) > 1)
 GROUP BY u.phone HAVING count(t.ticket_id) > 4 ORDER BY so_ve DESC LIMIT 10;
SELECT count(*) AS so_dien_thoai_bi_gan_co FROM (
  SELECT u.phone FROM users u JOIN orders o ON o.user_id = u.user_id AND o.status = 'PAID'
    JOIN tickets t ON t.order_id = o.order_id
   WHERE o.event_id = 5 AND u.phone IN (SELECT phone FROM users GROUP BY phone HAVING count(*) > 1)
   GROUP BY u.phone HAVING count(t.ticket_id) > 4) x;
\prompt '>> Enter: xem kế hoạch – truy vấn con IN được chuyển thành phép kết ' _
EXPLAIN (ANALYZE, BUFFERS)
SELECT u.phone, count(DISTINCT u.user_id), count(t.ticket_id)
  FROM users u JOIN orders o ON o.user_id = u.user_id AND o.status = 'PAID'
  JOIN tickets t ON t.order_id = o.order_id
 WHERE o.event_id = 5
   AND u.phone IN (SELECT phone FROM users GROUP BY phone HAVING count(*) > 1)
 GROUP BY u.phone HAVING count(t.ticket_id) > 4;
