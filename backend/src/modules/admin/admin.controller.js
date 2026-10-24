import * as svc from './admin.service.js';

const ok = (res, data, status = 200) => res.status(status).json(data);

export async function listEvents(req, res, next) {
  try { ok(res, { events: await svc.adminListEvents() }); } catch (e) { next(e); }
}
export async function createEvent(req, res, next) {
  try { ok(res, { event: await svc.adminCreateEvent(req) }, 201); } catch (e) { next(e); }
}
export async function updateEvent(req, res, next) {
  try { ok(res, { event: await svc.adminUpdateEvent(req) }); } catch (e) { next(e); }
}
export async function deleteEvent(req, res, next) {
  try { ok(res, await svc.adminDeleteEvent(req)); } catch (e) { next(e); }
}

export async function createZone(req, res, next) {
  try { ok(res, { zone: await svc.adminCreateZone(req) }, 201); } catch (e) { next(e); }
}
export async function updateZone(req, res, next) {
  try { ok(res, { zone: await svc.adminUpdateZone(req) }); } catch (e) { next(e); }
}
export async function deleteZone(req, res, next) {
  try { ok(res, await svc.adminDeleteZone(req)); } catch (e) { next(e); }
}

export async function getGenres(req, res, next) {
  try { ok(res, { genres: await svc.listGenres() }); } catch (e) { next(e); }
}
export async function getVenues(req, res, next) {
  try { ok(res, { venues: await svc.listVenues() }); } catch (e) { next(e); }
}
