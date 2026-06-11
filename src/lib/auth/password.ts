import bcrypt from "bcryptjs";

/** Hashing de passwords con bcryptjs (JS puro: sin binarios nativos en Docker). */

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
