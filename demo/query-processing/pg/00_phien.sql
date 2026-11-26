-- Thiết lập chung cho mọi thí nghiệm: tắt truy vấn song song và JIT như khi đo cho báo cáo
\pset pager off
\set QUIET 1
SET max_parallel_workers_per_gather = 0;
SET jit = off;
\set QUIET 0
