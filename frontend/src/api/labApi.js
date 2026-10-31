import { api } from './client.js';

export const labApi = {
  dataStorage: {
    myTickets:   (userId) => api(`/labs/data-storage/my-tickets?userId=${userId}`),
    storageSize: ()       => api('/labs/data-storage/storage-size'),
  },
  indexing: {
    explainCompare: ({ userId, eventId, status } = {}) => {
      const q = new URLSearchParams();
      if (userId) q.set('userId', userId);
      if (eventId) q.set('eventId', eventId);
      if (status) q.set('status', status);
      return api(`/labs/indexing/explain-compare?${q.toString()}`);
    },
  },
  queryProcessing: {
    revenueReport: () => api('/labs/query-processing/revenue-report'),
  },
  transaction: {
    simulate: ({ shouldFail = false, userId, eventId } = {}) =>
      api('/labs/transaction/simulate', {
        method: 'POST',
        body: JSON.stringify({ shouldFail, userId, eventId }),
      }),
  },
  concurrencyControl: {
    simulateRushHour: ({ concurrency = 20, seatsCount = 3 } = {}) =>
      api('/labs/concurrency-control/simulate-rush-hour', {
        method: 'POST',
        body: JSON.stringify({ concurrency, seatsCount }),
      }),
  },
  backupRecovery: {
    simulate: () =>
      api('/labs/backup-recovery/simulate', {
        method: 'POST',
      }),
  },
};
