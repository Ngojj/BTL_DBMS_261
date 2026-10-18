import test from 'node:test';
import assert from 'node:assert/strict';

import { pool } from '../src/config/pg.js';
import * as bookingRepo from '../src/modules/booking/booking.repository.js';
import * as bookingService from '../src/modules/booking/booking.service.js';

const future = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();

function createClient({ orderStatus = 'PENDING' } = {}) {
	const statements = [];
	return {
		statements,
		release() {},
		async query(sql, params = []) {
			const text = String(sql);
			statements.push({ text, params });
			if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
			if (/SELECT user_id FROM users/.test(text)) return { rows: [{ user_id: '7' }] };
			if (/FROM events WHERE event_id/.test(text)) {
				return { rows: [{ event_id: '1', status: 'ON_SALE', sale_open_at: future(-5), event_date: future(1440), max_tickets_per_user: 4 }] };
			}
			if (/SELECT o\.order_id/.test(text) && /FOR UPDATE/.test(text)) return { rows: [] };
			if (/SELECT COUNT\(\*\)/.test(text)) return { rows: [{ count: 0 }] };
			if (/SELECT s\.seat_id, s\.status/.test(text)) {
				return { rows: params[0].map((seatId) => ({ seat_id: String(seatId), status: 'AVAILABLE', held_by: null, event_id: '1', price: 500000 })) };
			}
			if (/INSERT INTO orders/.test(text)) {
				return { rows: [{ order_id: '99', user_id: '7', event_id: '1', total: params[2], status: 'PENDING', expires_at: future(10) }] };
			}
			if (/INSERT INTO tickets/.test(text)) {
				return { rows: [{ ticket_id: '200', seat_id: params[1], qr_code: 'demo-qr', price: params[2] }] };
			}
			if (/SELECT \* FROM orders WHERE order_id/.test(text)) {
				return { rows: [{ order_id: '99', user_id: '7', event_id: '1', total: 500000, status: orderStatus, expires_at: future(10) }] };
			}
			if (/SELECT t\.seat_id, s\.status/.test(text)) {
				return { rows: [{ seat_id: '10', status: 'HELD', held_by: '7', held_until: future(10) }] };
			}
			if (/SELECT ticket_id, seat_id, status FROM tickets/.test(text)) {
				return { rows: [{ ticket_id: '200', seat_id: '10', status: 'VALID' }] };
			}
			return { rows: [] };
		},
	};
}

test('booking creates a pending order, inserts tickets, and holds selected seats in one transaction', async () => {
	const originalConnect = pool.connect;
	const client = createClient();
	pool.connect = async () => client;
	try {
		const order = await bookingRepo.createOrder({ user: { userId: '7' }, body: { eventId: '1', seatIds: ['11', '10'] } });
		assert.equal(order.orderId, '99');
		assert.equal(order.total, 1000000);
		assert.equal(order.ticketCount, 2);
		assert.equal(client.statements[0].text, 'BEGIN');
		assert.equal(client.statements.at(-1).text, 'COMMIT');
		assert.equal(client.statements.some(({ text }) => /FROM users WHERE user_id = \$1 FOR UPDATE/.test(text)), true);
	} finally {
		pool.connect = originalConnect;
	}
});

test('booking rejects invalid or duplicate seat IDs before opening a transaction', async () => {
	const originalConnect = pool.connect;
	pool.connect = async () => assert.fail('Database should not be used for invalid seat ids');
	try {
		await assert.rejects(
			() => bookingRepo.createOrder({ user: { userId: '7' }, body: { eventId: '1', seatIds: ['10', '10'] } }),
			(error) => error.status === 400 && error.code === 'VALIDATION',
		);
	} finally {
		pool.connect = originalConnect;
	}
});

test('fake payment marks the order paid and inserts a successful payment', async () => {
	const originalConnect = pool.connect;
	const client = createClient();
	pool.connect = async () => client;
	try {
		const result = await bookingRepo.payOrder({ user: { userId: '7' }, params: { orderId: '99' } });
		assert.equal(result.status, 'PAID');
		assert.equal(client.statements.some(({ text }) => /INSERT INTO payments/.test(text)), true);
		assert.equal(client.statements.some(({ text }) => /UPDATE orders SET status = 'PAID'/.test(text)), true);
	} finally {
		pool.connect = originalConnect;
	}
});

test('cancelling a paid order records a refund and releases its seats', async () => {
	const originalConnect = pool.connect;
	const client = createClient({ orderStatus: 'PAID' });
	pool.connect = async () => client;
	try {
		const result = await bookingRepo.cancelOrder({ user: { userId: '7' }, params: { orderId: '99' } });
		assert.equal(result.status, 'CANCELLED');
		assert.equal(client.statements.some(({ text }) => /status = 'REFUNDED'/.test(text)), true);
		assert.equal(client.statements.some(({ text }) => /UPDATE seats/.test(text)), true);
	} finally {
		pool.connect = originalConnect;
	}
});

test('booking service rejects admins before calling the repository', async () => {
	await assert.rejects(
		() => bookingService.createOrder({ user: { userId: '7', role: 'ADMIN' }, body: { eventId: '1', seatIds: ['10'] } }),
		(error) => error.status === 403 && error.code === 'FORBIDDEN',
	);
});
