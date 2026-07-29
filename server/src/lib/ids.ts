import { ID_PREFIX } from '../constants.js';

export function createId(prefix: keyof typeof ID_PREFIX | string): string {
  const value = prefix in ID_PREFIX ? ID_PREFIX[prefix as keyof typeof ID_PREFIX] : prefix;
  return `${value}_${crypto.randomUUID()}`;
}
