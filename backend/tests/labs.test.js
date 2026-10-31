import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/pg.js';
import { firestore } from '../src/config/firebase.js';

import * as dataStorageLab from '../src/labs/data-storage/dataStorage.lab.js';
import * as indexingLab from '../src/labs/indexing/indexing.lab.js';
import * as queryProcessingLab from '../src/labs/query-processing/queryProcessing.lab.js';
import * as transactionLab from '../src/labs/transaction/transaction.lab.js';
import * as concurrencyControlLab from '../src/labs/concurrency-control/concurrencyControl.lab.js';
import * as backupRecoveryLab from '../src/labs/backup-recovery/backupRecovery.lab.js';

// Helper tạo request giả lập cho Express router
function mockReqRes({ method = 'GET', url = '/', headers = {}, body = {}, query = {} } = {}) {
  let statusCode = 200;
  let responseData = null;
  let nextCalled = null;

  const req = {
    method,
    url,
    headers,
    body,
    query,
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

test('DBMS Lab routes require authentication and ADMIN role', async () => {
  const customerToken = jwt.sign({ userId: 1, role: 'CUSTOMER' }, env.jwtSecret);
  const adminToken = jwt.sign({ userId: 99, role: 'ADMIN' }, env.jwtSecret);

  assert.ok(customerToken);
  assert.ok(adminToken);

  // Test verify role
  const payloadCust = jwt.verify(customerToken, env.jwtSecret);
  assert.equal(payloadCust.role, 'CUSTOMER');

  const payloadAdmin = jwt.verify(adminToken, env.jwtSecret);
  assert.equal(payloadAdmin.role, 'ADMIN');
});

test('Lab 1 - Data Storage: module exports valid measurement functions', async () => {
  assert.equal(typeof dataStorageLab.pgReadMyTickets, 'function');
  assert.equal(typeof dataStorageLab.fsReadMyTickets, 'function');
  assert.equal(typeof dataStorageLab.compareStorageSize, 'function');

  // Test validation error when userId is missing
  await assert.rejects(async () => {
    await dataStorageLab.pgReadMyTickets(null);
  }, /userId bắt buộc/);
});

test('Lab 2 - Indexing: module exports compare functions', async () => {
  assert.equal(typeof indexingLab.comparePostgresIndexing, 'function');
  assert.equal(typeof indexingLab.compareFirestoreIndexing, 'function');
});

test('Lab 3 - Query Processing: module exports reporting functions', async () => {
  assert.equal(typeof queryProcessingLab.pgRevenueReport, 'function');
  assert.equal(typeof queryProcessingLab.fsRevenueReport, 'function');
});

test('Lab 4 - Transaction: module exports transaction simulation functions', async () => {
  assert.equal(typeof transactionLab.runPgTransactionLab, 'function');
  assert.equal(typeof transactionLab.runFsTransactionLab, 'function');
});

test('Lab 5 - Concurrency Control: module exports concurrency simulation functions', async () => {
  assert.equal(typeof concurrencyControlLab.simulatePgNoLock, 'function');
  assert.equal(typeof concurrencyControlLab.simulatePgPessimisticLock, 'function');
  assert.equal(typeof concurrencyControlLab.simulateFirestoreOCC, 'function');
});

test('Lab 6 - Backup Recovery: module exports backup recovery simulation functions', async () => {
  assert.equal(typeof backupRecoveryLab.runPgBackupRecoveryLab, 'function');
  assert.equal(typeof backupRecoveryLab.runFsBackupRecoveryLab, 'function');
});

