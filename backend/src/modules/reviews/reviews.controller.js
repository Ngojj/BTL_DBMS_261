import * as svc from './reviews.service.js';

export async function postReview(req, res, next) {
  try {
    const review = await svc.createReview({ ...req, params: req.params, body: req.body, user: req.user });
    res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
}

export async function listReviews(req, res, next) {
  try {
    const data = await svc.getEventReviews(req);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
