import bcrypt from 'bcryptjs';
import { getConfig } from '../config';

/**
 * Password hashing utilities
 * Uses bcrypt for secure password hashing
 */

/**
 * Hash a password using bcrypt
 * @param password - Plain text password to hash
 * @param env - Environment object for config
 * @returns Hashed password
 */
export async function hashPassword(password: string, env?: object): Promise<string> {
  const config = getConfig(env);
  return bcrypt.hash(password, config.auth.bcryptRounds);
}

/**
 * Verify a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Stored hash to compare against
 * @returns true if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
