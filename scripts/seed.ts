/**
 * Seed script for kumo-budget
 *
 * This script generates SQL to seed the database with a test user.
 * Run with: npm run db:seed | npx wrangler d1 execute kumo-budget-db --local
 *
 * Or copy the output and run manually with wrangler.
 */

import bcrypt from 'bcryptjs';

// Configuration - can be overridden via environment variables
const config = {
  username: process.env.SEED_USERNAME ?? 'admin',
  password: process.env.SEED_PASSWORD ?? 'admin',
  bcryptRounds: 10,
};

async function generateSeedSQL(): Promise<void> {
  const hash = await bcrypt.hash(config.password, config.bcryptRounds);

  // Escape single quotes in values for SQL safety
  const escapedUsername = config.username.replace(/'/g, "''");
  const escapedHash = hash.replace(/'/g, "''");

  const sql = `
-- Seed user for kumo-budget
-- Username: ${config.username}
-- Password: ${config.password}
-- Generated: ${new Date().toISOString()}

INSERT OR IGNORE INTO users (username, password_hash)
VALUES ('${escapedUsername}', '${escapedHash}');
`.trim();

  // Output SQL to stdout for piping to wrangler
  console.log(sql);
}

// Run the script
generateSeedSQL().catch((error: unknown) => {
  console.error('Failed to generate seed SQL:', error);
  process.exit(1);
});
