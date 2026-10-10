import test from 'node:test';
import assert from 'node:assert/strict';

import { pool } from '../src/config/pg.js';
import * as eventsRepo from '../src/modules/events/events.repository.js';
import * as zonesRepo from '../src/modules/zones/zones.repository.js';

const withMockedQuery = async (fn) => {
  const original = pool.query;
  pool.query = async (...args) => fn(...args);
  try {
    await fn();
  } finally {
    pool.query = original;
  }
};

test('events repository createEvent inserts a new event and returns created row', async () => {
  const queryCalls = [];
  const original = pool.query;
  pool.query = async (sql, params) => {
    queryCalls.push({ sql, params });
    return { rows: [{ event_id: '101', title: 'Sunset Live', genre_id: 1, venue_id: 2, status: 'DRAFT' }] };
  };

  try {
    const result = await eventsRepo.createEvent({
      body: {
        title: 'Sunset Live',
        genreId: 1,
        venueId: 2,
        eventDate: '2026-12-10T20:00:00.000Z',
        saleOpenAt: '2026-11-01T09:00:00.000Z',
        maxTicketsPerUser: 4,
        status: 'DRAFT',
      },
    });

    assert.equal(result.title, 'Sunset Live');
    assert.equal(queryCalls[0].params[0], 'Sunset Live');
    assert.match(queryCalls[0].sql, /INSERT INTO events/i);
  } finally {
    pool.query = original;
  }
});

test('events service rejects invalid createEvent data before query', async () => {
  await assert.rejects(
    () => eventsRepo.createEvent({ body: { title: '', venueId: 1 } }),
    (err) => err.status === 400 && err.code === 'VALIDATION',
  );
});

test('zones repository generateSeats inserts a full seat row set for a zone', async () => {
  const original = pool.query;
  const rows = [];
  pool.query = async (sql, params) => {
    rows.push({ sql, params });
    return { rows: [{ zone_id: '55' }] };
  };

  try {
    const result = await zonesRepo.generateSeats({ params: { zoneId: '55' }, body: { rowsPerBlock: 5 } });
    assert.equal(result.zoneId, '55');
    assert.equal(rows.length >= 2, true);
    assert.match(rows[0].sql, /SELECT .* FROM zones/i);
  } finally {
    pool.query = original;
  }
});
