-- =====================================================================
-- TicketRush – PostgreSQL schema (v1, 29/09/2026)
-- 10 bảng: users, genres, venues, events, zones, seats,
--          orders, tickets, payments, reviews
-- Chạy: psql -d ticketrush -f schema.sql
-- =====================================================================

DROP TABLE IF EXISTS reviews, payments, tickets, orders, seats, zones,
                     events, venues, genres, users CASCADE;
DROP TYPE IF EXISTS user_role, event_status, seat_status, order_status,
                    ticket_status, payment_status, payment_method CASCADE;

-- ---------- Kiểu liệt kê (vòng đời dữ liệu) ----------
CREATE TYPE user_role      AS ENUM ('CUSTOMER', 'ADMIN', 'STAFF');
CREATE TYPE event_status   AS ENUM ('DRAFT', 'ON_SALE', 'SOLD_OUT', 'CANCELLED', 'ENDED');
CREATE TYPE seat_status    AS ENUM ('AVAILABLE', 'HELD', 'SOLD');
CREATE TYPE order_status   AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED');
CREATE TYPE ticket_status  AS ENUM ('VALID', 'CHECKED_IN', 'CANCELLED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
CREATE TYPE payment_method AS ENUM ('CARD', 'E_WALLET', 'BANK_TRANSFER');

-- ---------- Danh mục ----------
CREATE TABLE users (
    user_id     BIGSERIAL    PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    phone       VARCHAR(15)  NOT NULL,          -- không UNIQUE: dùng để phát hiện gom vé
    full_name   VARCHAR(100) NOT NULL,
    password_hash TEXT       NOT NULL,
    role        user_role    NOT NULL DEFAULT 'CUSTOMER',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_phone CHECK (phone ~ '^[0-9]{9,15}$')
);

CREATE TABLE genres (
    genre_id  SERIAL      PRIMARY KEY,
    name      VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE venues (
    venue_id  SERIAL       PRIMARY KEY,
    name      VARCHAR(150) NOT NULL,
    city      VARCHAR(50)  NOT NULL,
    address   VARCHAR(255) NOT NULL,
    UNIQUE (name, city)
);

-- ---------- Sự kiện và sơ đồ chỗ ngồi ----------
CREATE TABLE events (
    event_id      BIGSERIAL    PRIMARY KEY,
    title         VARCHAR(200) NOT NULL,
    genre_id      INT          NOT NULL REFERENCES genres(genre_id),
    venue_id      INT          NOT NULL REFERENCES venues(venue_id),
    event_date    TIMESTAMPTZ  NOT NULL,
    sale_open_at  TIMESTAMPTZ  NOT NULL,
    max_tickets_per_user SMALLINT NOT NULL DEFAULT 4,
    status        event_status NOT NULL DEFAULT 'DRAFT',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_sale_before_event CHECK (sale_open_at < event_date),
    CONSTRAINT chk_max_tickets CHECK (max_tickets_per_user BETWEEN 1 AND 10)
);

CREATE TABLE zones (
    zone_id   BIGSERIAL     PRIMARY KEY,
    event_id  BIGINT        NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    name      VARCHAR(30)   NOT NULL,           -- VIP, CAT1, GA...
    price     NUMERIC(12,0) NOT NULL,           -- VND
    capacity  INT           NOT NULL,
    UNIQUE (event_id, name),
    CONSTRAINT chk_price CHECK (price >= 0),
    CONSTRAINT chk_capacity CHECK (capacity > 0)
);

CREATE TABLE seats (
    seat_id     BIGSERIAL   PRIMARY KEY,
    zone_id     BIGINT      NOT NULL REFERENCES zones(zone_id) ON DELETE CASCADE,
    row_label   VARCHAR(5)  NOT NULL,
    seat_no     SMALLINT    NOT NULL,
    status      seat_status NOT NULL DEFAULT 'AVAILABLE',
    held_by     BIGINT      REFERENCES users(user_id),
    held_until  TIMESTAMPTZ,
    version     INT         NOT NULL DEFAULT 0,  -- cho khóa lạc quan (topic Concurrency)
    UNIQUE (zone_id, row_label, seat_no),
    -- Ghế đang giữ phải có người giữ và hạn giữ; ghế khác thì không
    CONSTRAINT chk_hold CHECK (
        (status = 'HELD'  AND held_by IS NOT NULL AND held_until IS NOT NULL) OR
        (status <> 'HELD' AND held_by IS NULL     AND held_until IS NULL)
    )
);

-- ---------- Giao dịch ----------
CREATE TABLE orders (
    order_id    BIGSERIAL     PRIMARY KEY,
    user_id     BIGINT        NOT NULL REFERENCES users(user_id),
    event_id    BIGINT        NOT NULL REFERENCES events(event_id),
    total       NUMERIC(14,0) NOT NULL DEFAULT 0,
    status      order_status  NOT NULL DEFAULT 'PENDING',
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ   NOT NULL DEFAULT now() + INTERVAL '10 minutes',
    CONSTRAINT chk_total CHECK (total >= 0)
);

CREATE TABLE tickets (
    ticket_id      BIGSERIAL     PRIMARY KEY,
    order_id       BIGINT        NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    seat_id        BIGINT        NOT NULL REFERENCES seats(seat_id),
    price          NUMERIC(12,0) NOT NULL,       -- giá tại thời điểm mua
    qr_code        UUID          NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    status         ticket_status NOT NULL DEFAULT 'VALID',
    checked_in_at  TIMESTAMPTZ,
    CONSTRAINT chk_ticket_price CHECK (price >= 0),
    CONSTRAINT chk_checkin CHECK ((status = 'CHECKED_IN') = (checked_in_at IS NOT NULL))
);

-- Ràng buộc then chốt: một ghế chỉ có tối đa MỘT vé còn hiệu lực
CREATE UNIQUE INDEX uq_active_ticket_per_seat
    ON tickets(seat_id) WHERE status <> 'CANCELLED';

CREATE TABLE payments (
    payment_id  BIGSERIAL      PRIMARY KEY,
    order_id    BIGINT         NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    amount      NUMERIC(14,0)  NOT NULL,
    method      payment_method NOT NULL,
    status      payment_status NOT NULL DEFAULT 'PENDING',
    paid_at     TIMESTAMPTZ,
    CONSTRAINT chk_amount CHECK (amount > 0),
    CONSTRAINT chk_paid_at CHECK ((status = 'SUCCESS') <= (paid_at IS NOT NULL))
);
-- Mỗi đơn chỉ có tối đa một lần thanh toán thành công
CREATE UNIQUE INDEX uq_success_payment_per_order
    ON payments(order_id) WHERE status = 'SUCCESS';

CREATE TABLE reviews (
    review_id   BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(user_id),
    event_id    BIGINT      NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    rating      SMALLINT    NOT NULL,
    comment     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, event_id),
    CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5)
);

-- ---------- Quy tắc nghiệp vụ không diễn đạt được bằng CHECK ----------
-- 1) Ghế của vé phải thuộc đúng sự kiện của đơn hàng
-- 2) Mỗi người không vượt quá max_tickets_per_user vé còn hiệu lực cho một sự kiện
CREATE OR REPLACE FUNCTION trg_ticket_rules() RETURNS trigger AS $$
DECLARE
    v_user   BIGINT;
    v_event  BIGINT;
    v_seat_event BIGINT;
    v_limit  SMALLINT;
    v_count  INT;
BEGIN
    SELECT o.user_id, o.event_id, e.max_tickets_per_user
      INTO v_user, v_event, v_limit
      FROM orders o JOIN events e ON e.event_id = o.event_id
     WHERE o.order_id = NEW.order_id;

    SELECT z.event_id INTO v_seat_event
      FROM seats s JOIN zones z ON z.zone_id = s.zone_id
     WHERE s.seat_id = NEW.seat_id;

    IF v_seat_event <> v_event THEN
        RAISE EXCEPTION 'Ghế % không thuộc sự kiện %', NEW.seat_id, v_event;
    END IF;

    IF NEW.status <> 'CANCELLED' THEN
        SELECT count(*) INTO v_count
          FROM tickets t JOIN orders o ON o.order_id = t.order_id
         WHERE o.user_id = v_user AND o.event_id = v_event
           AND t.status <> 'CANCELLED' AND t.ticket_id <> NEW.ticket_id;
        IF v_count + 1 > v_limit THEN
            RAISE EXCEPTION 'Người dùng % đã đạt giới hạn % vé cho sự kiện %',
                            v_user, v_limit, v_event;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_rules
    BEFORE INSERT OR UPDATE OF seat_id, status, order_id ON tickets
    FOR EACH ROW EXECUTE FUNCTION trg_ticket_rules();

-- ---------- Index cho khóa ngoại và truy vấn thường dùng ----------
-- (Thành viên 2 sẽ bổ sung/đo lại trong topic Indexing)
CREATE INDEX idx_events_genre     ON events(genre_id);
CREATE INDEX idx_events_venue     ON events(venue_id);
CREATE INDEX idx_events_date      ON events(event_date);
CREATE INDEX idx_zones_event      ON zones(event_id);
CREATE INDEX idx_seats_zone_status ON seats(zone_id, status);
CREATE INDEX idx_orders_user_event ON orders(user_id, event_id);
CREATE INDEX idx_tickets_order    ON tickets(order_id);
CREATE INDEX idx_payments_order   ON payments(order_id);
CREATE INDEX idx_reviews_event    ON reviews(event_id);