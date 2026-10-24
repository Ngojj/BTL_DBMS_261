import { api } from './client.js';

export const labApi = {
  dataStorage: {
    myTickets:    (userId) => api(`/labs/data-storage/my-tickets?userId=${userId}`),
    storageSize:  ()       => api('/labs/data-storage/storage-size'),
  },
};
