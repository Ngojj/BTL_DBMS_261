import * as repo from './checkin.repository.js';

export const checkinByQr  = (qrCode) => repo.checkinByQr(qrCode);
export const lookupTicket = (qrCode) => repo.getTicketByQr(qrCode);
