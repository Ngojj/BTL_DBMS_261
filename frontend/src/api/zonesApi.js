import { api } from "./client.js";

export const zonesApi = {
  list: (eventId) => api("/events/" + eventId + "/zones"),

  create: (eventId, body) =>
    api("/events/" + eventId + "/zones", {
      method: "POST",
      body,
    }),

  update: (zoneId, body) =>
    api("/zones/" + zoneId, {
      method: "PUT",
      body,
    }),

  remove: (zoneId) =>
    api("/zones/" + zoneId, {
      method: "DELETE",
    }),

  generateSeats: (zoneId, body = {}) =>
    api("/zones/" + zoneId + "/generate-seats", {
      method: "POST",
      body,
    }),
};
