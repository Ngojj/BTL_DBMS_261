import test from 'node:test';
import assert from 'node:assert/strict';

import { pool } from '../src/config/pg.js';
import * as eventsRepo from '../src/modules/events/events.repository.js';
import * as zonesRepo from '../src/modules/zones/zones.repository.js';

test('event catalog lists events available for sale with minimum zone price', async () => {
	const originalQuery = pool.query;
	let sql;
	pool.query = async (query) => {
		sql = String(query);
		return { rows: [{ event_id: '1', title: 'Demo', min_price: 500000 }] };
	};
	try {
		const result = await eventsRepo.listEvents();
		assert.equal(result[0].title, 'Demo');
		assert.match(sql, /e\.status IN \('ON_SALE', 'SOLD_OUT'\)/);
		assert.match(sql, /MIN\(z\.price\)/);
	} finally {
		pool.query = originalQuery;
	}
});

test('event detail includes its zone list', async () => {
	const originalQuery = pool.query;
	const calls = [];
	pool.query = async (sql, params) => {
		calls.push({ sql: String(sql), params });
		if (String(sql).includes('FROM events e')) return { rows: [{ event_id: '1', title: 'Demo' }] };
		return { rows: [{ zone_id: '2', name: 'GA', price: 500000 }] };
	};
	try {
		const event = await eventsRepo.getEvent({ params: { eventId: '1' } });
		assert.equal(event.title, 'Demo');
		assert.equal(event.zones[0].name, 'GA');
		assert.equal(calls.length, 2);
	} finally {
		pool.query = originalQuery;
	}
});

test('zone and seat reads are scoped to their parent IDs', async () => {
	const originalQuery = pool.query;
	const calls = [];
	pool.query = async (sql, params) => {
		calls.push({ sql: String(sql), params });
		return { rows: [{ seat_id: '10', status: 'AVAILABLE', price: 500000 }] };
	};
	try {
		await zonesRepo.listZones({ params: { eventId: '1' } });
		const seats = await zonesRepo.listSeats({ params: { zoneId: '2' } });
		assert.equal(seats[0].status, 'AVAILABLE');
		assert.deepEqual(calls.map((call) => call.params), [[1], [2]]);
	} finally {
		pool.query = originalQuery;
	}
});

test('event and zone reads reject invalid IDs before querying', async () => {
	const originalQuery = pool.query;
	pool.query = async () => assert.fail('Database should not be queried for invalid ids');
	try {
		await assert.rejects(() => eventsRepo.getEvent({ params: { eventId: '0' } }), (error) => error.status === 400);
		await assert.rejects(() => zonesRepo.listSeats({ params: { zoneId: 'bad' } }), (error) => error.status === 400);
	} finally {
		pool.query = originalQuery;
	}
});
