\set ON_ERROR_STOP on
\echo '========== TICKETRUSH | VERIFY 50K LARGE SEED =========='

-- CHI CHAY TRONG database ticketrush_benchmark.
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

\echo '========== 1. BENCHMARK DATA COUNTS =========='
WITH benchmark_data AS (
    SELECT
        COUNT(DISTINCT u.user_id) AS benchmark_users,
        COUNT(DISTINCT o.order_id) AS benchmark_orders,
        COUNT(t.ticket_id) AS benchmark_tickets,
        COUNT(t.ticket_id) FILTER (WHERE t.status = 'VALID') AS valid_tickets,
        COUNT(t.ticket_id) FILTER (WHERE t.status = 'CHECKED_IN') AS checked_in_tickets
    FROM public.users AS u
    LEFT JOIN public.orders AS o
        ON o.user_id = u.user_id
    LEFT JOIN public.tickets AS t
        ON t.order_id = o.order_id
    WHERE u.email LIKE 'bench.%@benchmark.ticketrush.local'
)
SELECT
    *,
    CASE
        WHEN benchmark_users = 5000
         AND benchmark_orders = 5000
         AND benchmark_tickets = 50000
         AND valid_tickets = 45000
         AND checked_in_tickets = 5000
        THEN 'OK - DUNG DATASET 50K'
        ELSE 'CHECK - SO LUONG KHONG KHOP MONG DOI'
    END AS verification_status
FROM benchmark_data;

-- Chan cac buoc tiep theo neu khong phai dataset 50K mong doi.
DO $$
DECLARE
    v_users BIGINT;
    v_orders BIGINT;
    v_tickets BIGINT;
    v_valid BIGINT;
    v_checked_in BIGINT;
BEGIN
    SELECT
        COUNT(DISTINCT u.user_id),
        COUNT(DISTINCT o.order_id),
        COUNT(t.ticket_id),
        COUNT(t.ticket_id) FILTER (WHERE t.status = 'VALID'),
        COUNT(t.ticket_id) FILTER (WHERE t.status = 'CHECKED_IN')
    INTO v_users, v_orders, v_tickets, v_valid, v_checked_in
    FROM public.users AS u
    LEFT JOIN public.orders AS o ON o.user_id = u.user_id
    LEFT JOIN public.tickets AS t ON t.order_id = o.order_id
    WHERE u.email LIKE 'bench.%@benchmark.ticketrush.local';

    IF v_users <> 5000 OR v_orders <> 5000 OR v_tickets <> 50000
       OR v_valid <> 45000 OR v_checked_in <> 5000 THEN
        RAISE EXCEPTION
            'Dataset 50K khong dung mong doi. users=%, orders=%, tickets=%, valid=%, checked_in=%',
            v_users, v_orders, v_tickets, v_valid, v_checked_in;
    END IF;
END
$$;

\echo '========== 2. EVENT DISTRIBUTION (BENCHMARK ROWS ONLY) =========='
SELECT
    e.event_id,
    e.title,
    COUNT(t.ticket_id) AS tickets,
    COUNT(t.ticket_id) FILTER (WHERE t.status = 'VALID') AS valid_tickets,
    COUNT(t.ticket_id) FILTER (WHERE t.status = 'CHECKED_IN') AS checked_in_tickets
FROM public.events AS e
JOIN public.orders AS o ON o.event_id = e.event_id
JOIN public.users AS u ON u.user_id = o.user_id
JOIN public.tickets AS t ON t.order_id = o.order_id
WHERE u.email LIKE 'bench.%@benchmark.ticketrush.local'
GROUP BY e.event_id, e.title
ORDER BY e.event_id;

\echo '========== 3. INDEXES RELATED TO THE DEMO =========='
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'tickets')
  AND indexname IN (
      'idx_orders_event_order',
      'idx_tickets_seat_id_fk',
      'idx_tickets_order',
      'idx_tickets_order_status'
  )
ORDER BY tablename, indexname;

\echo '========== 4. TABLE SIZES =========='
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(oid)) AS total_size
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('orders', 'tickets')
ORDER BY relname;

\echo '========== VERIFICATION COMPLETED =========='
