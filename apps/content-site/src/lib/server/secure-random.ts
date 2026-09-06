import { randomInt } from "node:crypto";

const RANDOM_INTEGER_LIMIT = 2 ** 32;

export const getSecureRandomUnit = (): number =>
  randomInt(RANDOM_INTEGER_LIMIT) / RANDOM_INTEGER_LIMIT;
