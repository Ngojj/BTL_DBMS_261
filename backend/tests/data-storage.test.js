import test from 'node:test';
import assert from 'node:assert/strict';

import { runLab } from '../src/labs/labRunner.js';
import * as pgLab from '../src/labs/data-storage/postgres.js';
import * as fsLab from '../src/labs/data-storage/firestore.js';

test('labs/data-storage exports run(params) functions for PostgreSQL and Firestore', () => {
  assert.equal(typeof pgLab.run, 'function');
  assert.equal(typeof fsLab.run, 'function');
  assert.equal(typeof runLab, 'function');
});

test('labRunner wraps postgres and firestore runners into standardized structure', async () => {
  const mockResult = await runLab({
    topic: 'data-storage',
    scenario: 'Test Data storage',
    params: { tickets: 1000 },
    postgres: async () => ({
      metrics: { storageBytes: 102400, readsForMyTickets: 1, estimatedCost: '0 đ (self-hosted)' },
    }),
    firestore: async () => ({
      metrics: { storageBytes: 204800, readsForMyTickets: 4, estimatedCost: '$0.24 / 100K lượt xem' },
    }),
  });

  assert.equal(mockResult.topic, 'data-storage');
  assert.equal(mockResult.results.postgres.ok, true);
  assert.equal(mockResult.results.firestore.ok, true);
  assert.equal(mockResult.results.postgres.metrics.readsForMyTickets, 1);
  assert.equal(mockResult.results.firestore.metrics.readsForMyTickets, 4);
});
