import test from 'node:test';
import assert from 'node:assert/strict';

import { pool } from '../src/config/pg.js';
import * as bookingRepo from '../src/modules/booking/booking.repository.js';

const createMockClient = () => ({
  query: async (sql, params = []) => {
    const text = String(sql).toLowerCase();

    if (text.includes('from users')) {
      return { rows: [{ user_id: '7', role: 'CUSTOMER' }] };
    }
    if (text.includes('from events')) {
      return {
        rows: [{
          event_id: '1',
          title: 'Demo',
          sale_open_at: '2026-01-01T00:00:00.000Z',
          event_date: '2026-12-05T00:00:00.000Z',
          max_tickets_per_user: 4,
        }],
      };
    }
    if (text.includes('count(*)')) {
      return { rows: [{ count: '0' }] };
    }
    if (text.includes('from seats') && text.includes('join zones')) {
      return {
        rows: [
          { seat_id: '10', zone_id: '2', status: 'AVAILABLE', held_by: null, held_until: null, event_id: '1', price: 500000 },
          { seat_id: '11', zone_id: '2', status: 'AVAILABLE', held_by: null, held_until: null, event_id: '1', price: 500000 },
        ],
      };
    }
    if (text.includes('insert into orders')) {
      return { rows: [{ order_id: '99', user_id: '7', event_id: '1', total: 1000000, status: 'PENDING', expires_at: '2026-12-01T00:00:00.000Z' }] };
    }
    if (text.includes('insert into tickets')) {
      return { rows: [{ ticket_id: '200', order_id: '99', seat_id: params[1], price: params[2], status: 'VALID' }] };
    }
    if (text.includes('update seats')) {
      return { rows: [{ seat_id: params[1] ?? '10' }] };
    }
    if (text.includes('select * from orders')) {
      return { rows: [{ order_id: '99', user_id: '7', event_id: '1', status: 'PENDING', total: 1000000 }] };
    }
    if (text.includes('select * from tickets')) {
      return { rows: [{ ticket_id: '200', order_id: '99', seat_id: '10', status: 'VALID' }, { ticket_id: '201', order_id: '99', seat_id: '11', status: 'VALID' }] };
    }
    if (text.includes('update tickets set status = \'cancelled\'')) {
      return { rows: [{ ticket_id: '200' }] };
    }
    return { rows: [] };
  },
  release: () => {},
});

test('booking repository creates order for valid seats', async () => {
  const originalConnect = pool.connect;
  pool.connect = async () => createMockClient();

  try {
    const result = await bookingRepo.createOrder({
      user: { userId: '7', role: 'CUSTOMER' },
      body: { eventId: '1', seatIds: ['10', '11'] },
    });

    assert.equal(result.orderId, '99');
    assert.equal(result.total, 1000000);
    assert.equal(result.ticketCount, 2);
  } finally {
    pool.connect = originalConnect;
  }
});

test('booking repository cancels order and frees seats', async () => {
  const originalConnect = pool.connect;
  pool.connect = async () => createMockClient();

  try {
    const result = await bookingRepo.cancelOrder({
      user: { userId: '7', role: 'CUSTOMER' },
      params: { orderId: '99' },
    });

    assert.equal(result.cancelled, true);
    assert.equal(result.orderId, '99');
    assert.equal(Array.isArray(result.seatIds), true);
  } finally {
    pool.connect = originalConnect;
  }
});
