-- TN1 – Truy vấn chọn theo điều kiện: PostgreSQL tự chọn đường truy cập
\i /tmp/qp/00_phien.sql
\echo
\echo '===== TN1a. Soát vé: tra vé theo mã QR (có chỉ mục duy nhất trên qr_code) ====='
SELECT qr_code AS qr FROM tickets WHERE ticket_id = 123456 \gset
\echo 'Mã QR dùng để tra:' :qr
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM tickets WHERE qr_code = :'qr';
\prompt '>> Enter: bỏ chỉ mục trên qr_code (trong transaction, ROLLBACK ngay sau đó) ' _
BEGIN;
ALTER TABLE tickets DROP CONSTRAINT tickets_qr_code_key;
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM tickets WHERE qr_code = :'qr';
ROLLBACK;
\echo '-> Không có chỉ mục: vẫn trả lời được nhưng phải Seq Scan toàn bảng (so số buffers và Execution Time).'

\prompt '>> Enter: TN1b – lọc đơn hàng theo created_at với tỉ lệ dòng thỏa 1%, 30%, 50%, 100% ' _
SELECT percentile_disc(0.99) WITHIN GROUP (ORDER BY created_at) AS c1,
       percentile_disc(0.70) WITHIN GROUP (ORDER BY created_at) AS c30,
       percentile_disc(0.50) WITHIN GROUP (ORDER BY created_at) AS c50,
       percentile_disc(0.00) WITHIN GROUP (ORDER BY created_at) AS c100
  FROM orders \gset
\echo '--- 1% số đơn ---'
EXPLAIN (ANALYZE, TIMING OFF) SELECT count(total) FROM orders WHERE created_at >= :'c1';
\echo '--- 30% số đơn ---'
EXPLAIN (ANALYZE, TIMING OFF) SELECT count(total) FROM orders WHERE created_at >= :'c30';
\echo '--- 50% số đơn ---'
EXPLAIN (ANALYZE, TIMING OFF) SELECT count(total) FROM orders WHERE created_at >= :'c50';
\echo '--- 100% số đơn: kế hoạch bộ tối ưu tự chọn ---'
EXPLAIN (ANALYZE, TIMING OFF) SELECT count(total) FROM orders WHERE created_at >= :'c100';
\prompt '>> Enter: ép đi theo chỉ mục ở 100% để so sánh ' _
BEGIN;
SET LOCAL enable_seqscan = off;
SET LOCAL enable_bitmapscan = off;
EXPLAIN (ANALYZE, TIMING OFF) SELECT count(total) FROM orders WHERE created_at >= :'c100';
ROLLBACK;
\echo '-> Dưới ~30%: Bitmap Heap Scan; từ 50%: Seq Scan. Ép chỉ mục ở 100% chậm hơn => bộ tối ưu chọn đúng.'
