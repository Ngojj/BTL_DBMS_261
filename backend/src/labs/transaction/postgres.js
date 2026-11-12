import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from '../../config/pg.js';
import { parseParams } from './params.js';

export async function run(params = {}) {
  const { simulateFailure } = parseParams(params);
  const runId = randomUUID();
  const price = 200000;

  // Prepare and commit the initial state BEFORE the purchase transaction.
  // Otherwise, rollback would also remove the seat we want to inspect.
  const fixture = await withTransaction(async (client) => {
    // [a] Dedicated customer; the generated password value is not a login credential.
    const { rows: users } = await client.query(
      `
        INSERT INTO users (email, phone, full_name, password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING user_id
      `,
      [
        `lab-${runId}@example.invalid`,
        '0900000000',
        'Transaction Lab',
        `disabled-${runId}`,
      ],
    );

    // [a] Dedicated genre and venue, independent of seed data.
    const { rows: genres } = await client.query(
      'INSERT INTO genres (name) VALUES ($1) RETURNING genre_id',
      [`Lab-${runId}`],
    );

    const { rows: venues } = await client.query(
      `
        INSERT INTO venues (name, city, address)
        VALUES ($1, $2, $3)
        RETURNING venue_id
      `,
      [`Lab-${runId}`, 'Lab', 'Transaction experiment'],
    );

    // [a] Keep the test event in DRAFT.
    const { rows: events } = await client.query(
      `
        INSERT INTO events (
          title, genre_id, venue_id, event_date, sale_open_at, status
        )
        VALUES (
          $1, $2, $3,
          now() + INTERVAL '1 day',
          now() - INTERVAL '1 hour',
          'DRAFT'
        )
        RETURNING event_id
      `,
      [
        `Transaction Lab ${runId}`,
        genres[0].genre_id,
        venues[0].venue_id,
      ],
    );

    const { rows: zones } = await client.query(
      `
        INSERT INTO zones (event_id, name, price, capacity)
        VALUES ($1, 'LAB', $2, 1)
        RETURNING zone_id
      `,
      [events[0].event_id, price],
    );

    const { rows: seats } = await client.query(
      `
        INSERT INTO seats (zone_id, row_label, seat_no)
        VALUES ($1, 'A', 1)
        RETURNING seat_id
      `,
      [zones[0].zone_id],
    );

    return {
      userId: users[0].user_id,
      genreId: genres[0].genre_id,
      venueId: venues[0].venue_id,
      eventId: events[0].event_id,
      seatId: seats[0].seat_id,
    };
  });

  // [d,f,h] Read persisted state outside the purchase transaction.
  async function readState() {
    const { rows } = await pool.query(
      `
        SELECT
          s.status AS "seatStatus",
          s.held_by AS "heldBy",
          s.held_until AS "heldUntil",
          s.version,
          (
            SELECT COUNT(*)::int
            FROM orders
            WHERE event_id = $1
          ) AS orders,
          (
            SELECT COUNT(*)::int
            FROM orders
            WHERE event_id = $1 AND status = 'PAID'
          ) AS "paidOrders",
          (
            SELECT COUNT(*)::int
            FROM tickets t
            JOIN orders o ON o.order_id = t.order_id
            WHERE o.event_id = $1
          ) AS tickets,
          (
            SELECT COUNT(*)::int
            FROM tickets t
            JOIN orders o ON o.order_id = t.order_id
            WHERE o.event_id = $1 AND t.status = 'VALID'
          ) AS "validTickets",
          (
            SELECT COUNT(*)::int
            FROM payments p
            JOIN orders o ON o.order_id = p.order_id
            WHERE o.event_id = $1
          ) AS payments,
          (
            SELECT COUNT(*)::int
            FROM payments p
            JOIN orders o ON o.order_id = p.order_id
            WHERE o.event_id = $1 AND p.status = 'SUCCESS'
          ) AS "successfulPayments"
        FROM seats s
        WHERE s.seat_id = $2
      `,
      [fixture.eventId, fixture.seatId],
    );

    if (!rows[0]) {
      throw new Error('Không tìm thấy ghế thử nghiệm');
    }

    return rows[0];
  }

  try {
    const before = await readState();
    const simulatedError = new Error('Giả lập lỗi thanh toán');
    let failureInjected = false;

    try {
      await withTransaction(async (client) => {
        // Lock the customer first, then the seat.
        await client.query(
          'SELECT user_id FROM users WHERE user_id = $1 FOR UPDATE',
          [fixture.userId],
        );

        const { rows: seats } = await client.query(
          'SELECT status FROM seats WHERE seat_id = $1 FOR UPDATE',
          [fixture.seatId],
        );

        if (seats[0]?.status !== 'AVAILABLE') {
          throw new Error('Ghế thử nghiệm không còn trống');
        }

        // [c] Hold the seat.
        await client.query(
          `
            UPDATE seats
            SET status = 'HELD',
                held_by = $2,
                held_until = now() + INTERVAL '10 minutes',
                version = version + 1
            WHERE seat_id = $1
          `,
          [fixture.seatId, fixture.userId],
        );

        // [a] Create the order.
        const { rows: orders } = await client.query(
          `
            INSERT INTO orders (user_id, event_id, total)
            VALUES ($1, $2, $3)
            RETURNING order_id
          `,
          [fixture.userId, fixture.eventId, price],
        );

        const orderId = orders[0].order_id;

        // [a] Create the ticket and pending payment.
        await client.query(
          `
            INSERT INTO tickets (order_id, seat_id, price)
            VALUES ($1, $2, $3)
          `,
          [orderId, fixture.seatId, price],
        );

        await client.query(
          `
            INSERT INTO payments (order_id, amount, method, status)
            VALUES ($1, $2, 'CARD', 'PENDING')
          `,
          [orderId, price],
        );

        // Fail AFTER writes so rollback has actual changes to undo.
        if (simulateFailure) {
          throw simulatedError;
        }

        // [c] Complete the simulated payment and purchase.
        await client.query(
          `
            UPDATE payments
            SET status = 'SUCCESS', paid_at = now()
            WHERE order_id = $1
          `,
          [orderId],
        );

        await client.query(
          "UPDATE orders SET status = 'PAID' WHERE order_id = $1",
          [orderId],
        );

        await client.query(
          `
            UPDATE seats
            SET status = 'SOLD',
                held_by = NULL,
                held_until = NULL,
                version = version + 1
            WHERE seat_id = $1
          `,
          [fixture.seatId],
        );
      });
    } catch (err) {
      // Only the intentional failure is an expected experiment outcome.
      // Connection errors, SQL errors, etc. must reach labRunner.
      if (err !== simulatedError) throw err;
      failureInjected = true;
    }

    // Verify BEFORE cleanup, so cleanup cannot hide a rollback failure.
    const after = await readState();

    const rolledBack =
      failureInjected &&
      JSON.stringify(after) === JSON.stringify(before);

    const committed =
      !failureInjected &&
      after.orders === 1 &&
      after.paidOrders === 1 &&
      after.tickets === 1 &&
      after.validTickets === 1 &&
      after.payments === 1 &&
      after.successfulPayments === 1 &&
      after.seatStatus === 'SOLD' &&
      after.heldBy === null &&
      after.heldUntil === null &&
      after.version === before.version + 2;

    if (simulateFailure ? !rolledBack : !committed) {
      throw new Error(
        `Trạng thái sau giao dịch không đúng: ${JSON.stringify(after)}`,
      );
    }

    return {
      metrics: {
        committed,
        rolledBack,
        // Purchase records remaining after an intended rollback.
        // Records from a successful commit are expected, not leftovers.
        leftoverRecords: failureInjected
          ? after.orders + after.tickets + after.payments
          : 0,
      },
      details: {
        runId,
        simulateFailure,
        before,
        after,
      },
    };
  } finally {
    // [b] Delete only this run's records, in foreign-key-safe order.
    await withTransaction(async (client) => {
      // Cascades to tickets and payments.
      await client.query(
        'DELETE FROM orders WHERE event_id = $1',
        [fixture.eventId],
      );

      // Cascades to zones and seats.
      await client.query(
        'DELETE FROM events WHERE event_id = $1',
        [fixture.eventId],
      );

      await client.query(
        'DELETE FROM users WHERE user_id = $1',
        [fixture.userId],
      );

      await client.query(
        'DELETE FROM genres WHERE genre_id = $1',
        [fixture.genreId],
      );

      await client.query(
        'DELETE FROM venues WHERE venue_id = $1',
        [fixture.venueId],
      );
    });
  }
}
