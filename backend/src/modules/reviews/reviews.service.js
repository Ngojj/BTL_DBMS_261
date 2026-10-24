import * as repo from './reviews.repository.js';

export const createReview    = (input) => repo.createReview(input);
export const getEventReviews = (input) => repo.getEventReviews(input);
