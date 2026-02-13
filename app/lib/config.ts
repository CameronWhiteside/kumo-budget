/**
 * Application configuration
 * All configurable values are centralized here for easy management.
 * Values can be overridden via environment variables.
 */

export interface AppConfig {
  auth: {
    /** How many days a session lasts before expiring */
    sessionDurationDays: number;
    /** Name of the session cookie */
    sessionCookieName: string;
    /** Number of bcrypt salt rounds for password hashing */
    bcryptRounds: number;
  };
  seed: {
    /** Default username for seeded test user */
    defaultUsername: string;
    /** Default password for seeded test user */
    defaultPassword: string;
  };
}

/**
 * Get configuration from environment variables with defaults
 * @param env - Environment object from Cloudflare Worker
 * @returns Configuration object
 */
export function getConfig(env?: { SESSION_DURATION_DAYS?: string }): AppConfig {
  return {
    auth: {
      sessionDurationDays: env?.SESSION_DURATION_DAYS ? parseInt(env.SESSION_DURATION_DAYS, 10) : 7,
      sessionCookieName: 'kumo_session',
      bcryptRounds: 10,
    },
    seed: {
      defaultUsername: 'admin',
      defaultPassword: 'admin',
    },
  };
}

/**
 * Default configuration (used when env is not available)
 */
export const defaultConfig = getConfig();
