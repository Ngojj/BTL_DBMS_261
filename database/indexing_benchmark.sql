\set ON_ERROR_STOP on
\echo '========== TICKETRUSH | PREPARE INDEXING BENCHMARK =========='

-- CHI CHAY TRONG database ticketrush_benchmark.
-- File nay KHONG tao Single/Composite Index tren tickets; run_indexing_demo.sql
-- se tao dung mot loai theo bien use_composite.

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

-- Index ho tro loc Event va lay order_id tu orders.
CREATE INDEX IF NOT EXISTS idx_orders_event_order
    ON public.orders (event_id, order_id);

-- Index day du ho tro kiem tra FK tickets.seat_id trong large-seed --replace.
-- Day KHONG phai index muc tieu cua phep thu nghiem.
CREATE INDEX IF NOT EXISTS idx_tickets_seat_id_fk
    ON public.tickets (seat_id);

-- Don trang thai hai index dang duoc so sanh.
-- Chi xoa hai index benchmark nay, khong xoa PK, QR, FK hay index khac cua nhom.
DROP INDEX IF EXISTS public.idx_tickets_order;
DROP INDEX IF EXISTS public.idx_tickets_order_status;

-- Cap nhat thong ke sau khi nap Large Seed.
ANALYZE public.orders;
ANALYZE public.tickets;
ANALYZE public.events;

\echo '========== SUPPORT INDEXES =========='
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
      'idx_orders_event_order',
      'idx_tickets_seat_id_fk',
      'idx_tickets_order',
      'idx_tickets_order_status'
  )
ORDER BY indexname;

\echo '========== TABLE SIZES =========='
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(oid)) AS total_size
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('orders', 'tickets')
ORDER BY relname;

\echo '========== PREPARATION COMPLETED =========='
