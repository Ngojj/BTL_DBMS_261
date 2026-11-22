\set ON_ERROR_STOP on

-- LUA CHON INDEX DEMO:
-- true  = Composite Index (order_id, status) - LUA CHON MAC DINH.
-- false = Single Index (order_id).
-- Chi thay doi dong ben duoi neu muon doi loai Index demo.
\set use_composite true

\echo '========== TICKETRUSH | POSTGRESQL INDEX DEMO =========='

-- Bao ve: chi cho phep chay tren database benchmark rieng.
DO $$
BEGIN
    IF current_database() <> 'ticketrush_benchmark' THEN
        RAISE EXCEPTION
            'Sai database: dang o %, yeu cau ticketrush_benchmark. Dung script.',
            current_database();
    END IF;
END
$$;

SELECT current_database() AS current_database;

-- Xac nhan Index phuc vu truy van Event da duoc chuan bi.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'orders'
          AND indexname = 'idx_orders_event_order'
    ) THEN
        RAISE EXCEPTION
            'Thieu idx_orders_event_order. Hay chay indexing_benchmark.sql truoc.';
    END IF;
END
$$;

-- Moi lan demo chi giu mot trong hai Index muc tieu tren tickets.
DROP INDEX IF EXISTS public.idx_tickets_order;
DROP INDEX IF EXISTS public.idx_tickets_order_status;

\if :use_composite
    \echo '========== ACTIVE INDEX: COMPOSITE (order_id, status) =========='
    CREATE INDEX idx_tickets_order_status
        ON public.tickets (order_id, status);
\else
    \echo '========== ACTIVE INDEX: SINGLE (order_id) =========='
    CREATE INDEX idx_tickets_order
        ON public.tickets (order_id);
\endif

ANALYZE public.orders;
ANALYZE public.tickets;

\echo '========== INDEX DEFINITION USED BY THIS DEMO =========='
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
      'idx_orders_event_order',
      'idx_tickets_order',
      'idx_tickets_order_status'
  )
ORDER BY indexname;

-- ============================================================
-- PART A: SEQUENTIAL-SCAN CONTROL
-- Dung cung truy van Event 2, nhung han che cac loai Index Scan.
-- ENABLE_* = OFF la lam planner tranh chon Index, khong cam tuyet doi.
-- De PostgreSQL tu chon Join Method phu hop (thuong co the la Hash Join).
-- Khong ep Nested Loop o phan nay vi Seq Scan lap lai tren tickets
-- cho tung order se tao ra mot doi chung khong thuc te va rat ton kem.
-- ============================================================
\echo '========== EVENT 2 | SEQ SCAN CONTROL (INDEX SCANS DISCOURAGED) =========='
BEGIN READ ONLY;

SET LOCAL enable_seqscan = ON;
SET LOCAL enable_indexscan = OFF;
SET LOCAL enable_indexonlyscan = OFF;
SET LOCAL enable_bitmapscan = OFF;

-- Cho phep planner chon Join Method tu nhien cho Seq Scan control.
SET LOCAL enable_nestloop = ON;
SET LOCAL enable_hashjoin = ON;
SET LOCAL enable_mergejoin = ON;

SET LOCAL jit = OFF;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
    t.ticket_id,
    o.event_id,
    t.status,
    t.checked_in_at
FROM public.orders AS o
JOIN public.tickets AS t
    ON t.order_id = o.order_id
WHERE o.event_id = 2
  AND t.status = 'VALID'::ticket_status;

ROLLBACK;

-- ============================================================
-- PART B: INDEX-SCAN DEMONSTRATION
-- Dung cung truy van Event 2 va Index da chon o dau file.
-- Ep Nested Loop co kiem soat de lam ro Index Scan tren tickets.
-- Day la plan minh hoa Index, khong phai khang dinh planner mac dinh
-- luon chon Nested Loop hoac Index Scan.
-- ============================================================
\echo '========== EVENT 2 | NESTED LOOP + INDEX SCAN =========='
BEGIN READ ONLY;

SET LOCAL enable_seqscan = OFF;
SET LOCAL enable_indexscan = ON;
SET LOCAL enable_indexonlyscan = ON;
SET LOCAL enable_bitmapscan = OFF;

SET LOCAL enable_nestloop = ON;
SET LOCAL enable_hashjoin = OFF;
SET LOCAL enable_mergejoin = OFF;

SET LOCAL jit = OFF;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
    t.ticket_id,
    o.event_id,
    t.status,
    t.checked_in_at
FROM public.orders AS o
JOIN public.tickets AS t
    ON t.order_id = o.order_id
WHERE o.event_id = 2
  AND t.status = 'VALID'::ticket_status;

ROLLBACK;

\echo '========== DEMO COMPLETED =========='
\echo 'SEQ CONTROL: kiem tra Seq Scan va Join Method duoc chon.'
\echo 'INDEX DEMO: kiem tra Index Scan tren tickets, Index Cond va Filter.'
\echo 'Luu y: so sanh Execution Time cua mot lan chay chi mang tinh minh hoa;'
\echo 'dung bang benchmark nhieu lan chay de ket luan hieu nang.'
