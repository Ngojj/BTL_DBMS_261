import * as svc from './reports.service.js';

export async function getRevenue(req, res, next) {
  try {
    res.json({ data: await svc.revenueByZone(req) });
  } catch (err) {
    next(err);
  }
}

export async function getScalpers(req, res, next) {
  try {
    res.json(await svc.scalperDetection(req));
  } catch (err) {
    next(err);
  }
}
