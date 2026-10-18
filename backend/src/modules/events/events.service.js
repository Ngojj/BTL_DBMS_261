// TODO [events.service] Phụ trách: TV1 (#1, #8) + TV2 (#2)
import * as repo from './events.repository.js';

export async function listEvents(input) {
  return repo.listEvents(input);
}

export async function getEvent(input) {
  return repo.getEvent(input);
}
