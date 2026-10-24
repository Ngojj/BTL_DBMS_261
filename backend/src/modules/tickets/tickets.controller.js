import * as svc from './tickets.service.js';

export async function getMyTickets(req, res, next) {
  try {
    const tickets = await svc.listMyTickets(req);
    res.json({ tickets });
  } catch (err) {
    next(err);
  }
}
