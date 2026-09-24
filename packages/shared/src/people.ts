import type { Creator } from './api';

export const DELETED_USER_NAME = 'Deleted user';

type Person = Pick<Creator, 'username' | 'display_name' | 'deleted'>;

export function personName(person: Person) {
  if (person.deleted) return DELETED_USER_NAME;
  return person.display_name || person.username;
}

export function personHandle(person: Pick<Creator, 'username' | 'deleted'>) {
  return person.deleted ? DELETED_USER_NAME : `@${person.username}`;
}
