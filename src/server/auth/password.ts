import { compare, hash } from "bcryptjs";

export const BCRYPT_COST = 12;

// A valid cost-12 hash used only to keep failed-login timing consistent when
// the supplied email does not exist.
const DUMMY_PASSWORD_HASH =
  "$2b$12$eWqlaTiIk60rd90.H1E2NeHgywRDpPHS0yBwK6.1FOS4rFFqhm8ky";

export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST);
}

export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(password, passwordHash);
}

export async function performDummyPasswordCheck(password: string) {
  await compare(password, DUMMY_PASSWORD_HASH);
}
