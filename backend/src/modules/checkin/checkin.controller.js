import * as svc from './checkin.service.js';

export async function lookup(req, res, next) {
  try {
    const ticket = await svc.lookupTicket(req.params.qrCode);
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
}

export async function checkin(req, res, next) {
  try {
    const qrCode = req.params.qrCode ?? req.body?.qrCode;
    const result = await svc.checkinByQr(qrCode);
    res.json({ ticket: result });
  } catch (err) {
    next(err);
  }
}
