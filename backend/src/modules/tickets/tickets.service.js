import * as repo from './tickets.repository.js';

export const listMyTickets = (input) => repo.listMyTickets(input);
export const getTicketByQr = (qrCode) => repo.getTicketByQr(qrCode);
