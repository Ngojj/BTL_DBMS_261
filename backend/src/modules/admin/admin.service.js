import * as repo from './admin.repository.js';

export const adminListEvents  = ()      => repo.adminListEvents();
export const adminCreateEvent = (input) => repo.adminCreateEvent(input);
export const adminUpdateEvent = (input) => repo.adminUpdateEvent(input);
export const adminDeleteEvent = (input) => repo.adminDeleteEvent(input);

export const adminCreateZone  = (input) => repo.adminCreateZone(input);
export const adminUpdateZone  = (input) => repo.adminUpdateZone(input);
export const adminDeleteZone  = (input) => repo.adminDeleteZone(input);

export const listGenres = () => repo.listGenres();
export const listVenues = () => repo.listVenues();
