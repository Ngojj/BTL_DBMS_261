-- Nạp bộ dữ liệu của mục 3.3 (30.000 người dùng, 305 sự kiện, 499.589 vé) vào database ticketrush_qp.
-- Chạy bên trong container: psql -U ticketrush -d ticketrush_qp -f /tmp/qp/load.sql
\set ON_ERROR_STOP 1
\i /tmp/qp/schema.sql
\echo 'Đang nạp dữ liệu (khoảng 1 phút)...'
COPY genres   FROM PROGRAM 'gzip -dc /tmp/qp/data/genres.csv.gz'  CSV HEADER;
COPY venues   FROM PROGRAM 'gzip -dc /tmp/qp/data/venues.csv.gz'  CSV HEADER;
COPY users(user_id,email,phone,full_name,password_hash,role,created_at) FROM PROGRAM 'gzip -dc /tmp/qp/data/users.csv.gz' CSV HEADER;
COPY events   FROM PROGRAM 'gzip -dc /tmp/qp/data/events.csv.gz'  CSV HEADER;
COPY zones    FROM PROGRAM 'gzip -dc /tmp/qp/data/zones.csv.gz'   CSV HEADER;
COPY seats(seat_id,zone_id,row_label,seat_no,status,version) FROM PROGRAM 'gzip -dc /tmp/qp/data/seats.csv.gz' CSV HEADER;
COPY orders   FROM PROGRAM 'gzip -dc /tmp/qp/data/orders.csv.gz'  CSV HEADER;
COPY tickets(ticket_id,order_id,seat_id,price,qr_code,status,checked_in_at) FROM PROGRAM 'gzip -dc /tmp/qp/data/tickets.csv.gz' CSV HEADER NULL '';
COPY payments FROM PROGRAM 'gzip -dc /tmp/qp/data/payments.csv.gz' CSV HEADER NULL '';
COPY reviews  FROM PROGRAM 'gzip -dc /tmp/qp/data/reviews.csv.gz' CSV HEADER;
SELECT setval(pg_get_serial_sequence(t, c), m) FROM (VALUES
  ('users','user_id',(SELECT max(user_id) FROM users)),('events','event_id',(SELECT max(event_id) FROM events)),
  ('zones','zone_id',(SELECT max(zone_id) FROM zones)),('seats','seat_id',(SELECT max(seat_id) FROM seats)),
  ('orders','order_id',(SELECT max(order_id) FROM orders)),('tickets','ticket_id',(SELECT max(ticket_id) FROM tickets)),
  ('payments','payment_id',(SELECT max(payment_id) FROM payments)),('reviews','review_id',(SELECT max(review_id) FROM reviews))
) v(t, c, m);
-- Chỉ mục như database/schema.sql, cộng hai chỉ mục dùng trong TN1 (orders.event_id, orders.created_at)
CREATE INDEX idx_events_genre      ON events(genre_id);
CREATE INDEX idx_events_venue      ON events(venue_id);
CREATE INDEX idx_events_date       ON events(event_date);
CREATE INDEX idx_zones_event       ON zones(event_id);
CREATE INDEX idx_seats_zone_status ON seats(zone_id, status);
CREATE INDEX idx_orders_user_event ON orders(user_id, event_id);
CREATE INDEX idx_orders_event      ON orders(event_id);
CREATE INDEX idx_orders_created    ON orders(created_at);
CREATE INDEX idx_tickets_order     ON tickets(order_id);
CREATE INDEX idx_payments_order    ON payments(order_id);
CREATE INDEX idx_reviews_event     ON reviews(event_id);
VACUUM ANALYZE;
SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM events) AS events,
       (SELECT count(*) FROM seats) AS seats, (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM tickets) AS tickets;
