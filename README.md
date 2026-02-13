# Kumo Budget

A full-stack Cloudflare Worker with server-side rendering, authentication, and [Kumo UI](https://kumo-ui.com).

## Tech Stack

| Layer      | Technology                  |
| ---------- | --------------------------- |
| Framework  | React Router v7 (SSR)       |
| UI         | @cloudflare/kumo v1.5.0     |
| Database   | Cloudflare D1 + Drizzle ORM |
| Migrations | Drizzle Kit                 |
| Storage    | Cloudflare R2 (prepared)    |
| Auth       | Session cookies + bcrypt    |
| Runtime    | Cloudflare Workers          |

## Quick Start

### Prerequisites

- Node.js 20.18+ (20.19+ recommended, see `.nvmrc`)
- Wrangler CLI (`npm i -g wrangler`)
- Cloudflare account with D1 and R2 access

> **Note**: Use `nvm use` to switch to the correct Node version if you have nvm installed.

### Setup

1. **Clone and install**

   ```bash
   git clone git@github.com:CameronWhiteside/kumo-budget.git
   cd kumo-budget
   npm install
   ```

2. **Create Cloudflare resources** (if not already created)

   ```bash
   npx wrangler d1 create kumo-budget-db
   npx wrangler r2 bucket create kumo-budget-files
   ```

3. **Update wrangler.jsonc** with your database ID from step 2

4. **Run migrations**

   ```bash
   # Generate migrations (already done, but for future schema changes)
   npm run db:generate

   # Apply to local D1
   npm run db:migrate
   ```

5. **Seed test user**

   ```bash
   npx tsx scripts/seed.ts | CLOUDFLARE_ACCOUNT_ID=your-account-id npx wrangler d1 execute kumo-budget-db --local --command="$(cat)"
   ```

   Or manually:

   ```bash
   npx tsx scripts/seed.ts
   # Copy the output SQL and run:
   npx wrangler d1 execute kumo-budget-db --local --command="INSERT OR IGNORE INTO users ..."
   ```

6. **Start development**

   ```bash
   npm run dev
   ```

7. **Open** [http://localhost:5173](http://localhost:5173)

### Default Credentials

- **Username**: `admin`
- **Password**: `admin`

## Configuration

Environment variables can be set in `wrangler.jsonc` under `vars`:

| Variable                | Default | Description            |
| ----------------------- | ------- | ---------------------- |
| `SESSION_DURATION_DAYS` | 7       | How long sessions last |

Seed configuration (environment variables when running seed script):

| Variable        | Default | Description           |
| --------------- | ------- | --------------------- |
| `SEED_USERNAME` | admin   | Default seed user     |
| `SEED_PASSWORD` | admin   | Default seed password |

## Scripts

| Command                   | Description                          |
| ------------------------- | ------------------------------------ |
| `npm run dev`             | Start local dev server               |
| `npm run build`           | Build for production                 |
| `npm run deploy`          | Build and deploy to Cloudflare       |
| `npm run lint`            | Run ESLint                           |
| `npm run lint:fix`        | Run ESLint with auto-fix             |
| `npm run format`          | Format code with Prettier            |
| `npm run format:check`    | Check formatting without changes     |
| `npm run typecheck`       | Run TypeScript type checking         |
| `npm run db:generate`     | Generate Drizzle migrations          |
| `npm run db:migrate`      | Apply migrations locally             |
| `npm run db:migrate:prod` | Apply migrations to production       |
| `npm run db:studio`       | Open Drizzle Studio                  |
| `npm run db:seed`         | Generate seed SQL (pipe to wrangler) |

## Project Structure

```
kumo-budget/
├── app/
│   ├── routes/              # React Router routes (pages)
│   │   ├── home.tsx         # Protected home page
│   │   ├── login.tsx        # Login page
│   │   └── logout.tsx       # Logout action
│   ├── lib/
│   │   ├── db/              # Database layer (Drizzle)
│   │   │   ├── schema.ts    # Table definitions
│   │   │   ├── index.ts     # DB client factory
│   │   │   └── queries/     # Encapsulated queries
│   │   ├── auth/            # Authentication utilities
│   │   │   ├── password.ts  # Password hashing
│   │   │   ├── session.ts   # Session management
│   │   │   └── middleware.ts# Route protection
│   │   └── config.ts        # Centralized configuration
│   ├── root.tsx             # App root layout
│   ├── routes.ts            # Route definitions
│   └── app.css              # Global styles + Kumo
├── drizzle/
│   └── migrations/          # Generated SQL migrations
├── scripts/
│   └── seed.ts              # Database seeding script
├── workers/
│   └── app.ts               # Worker entry point
├── drizzle.config.ts        # Drizzle Kit configuration
├── wrangler.jsonc           # Cloudflare Worker config
├── eslint.config.js         # ESLint configuration
├── .prettierrc              # Prettier configuration
└── .husky/                  # Git hooks
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation.

## Development

### Code Quality

This project uses strict linting and formatting:

- **ESLint** with TypeScript strict rules
- **Prettier** for consistent formatting
- **Husky** + **lint-staged** for pre-commit hooks

All commits are automatically linted and formatted.

### Database Changes

1. Modify `app/lib/db/schema.ts`
2. Run `npm run db:generate` to create migration
3. Run `npm run db:migrate` to apply locally
4. Test thoroughly
5. Run `npm run db:migrate:prod` for production

### Authentication Flow

1. User visits `/` → Redirected to `/login` (no session)
2. User submits credentials → Server verifies with bcrypt
3. Server creates session in D1 → Sets HttpOnly cookie
4. User redirected to `/` → Session validated → Page loads
5. User clicks "Sign out" → Session deleted → Cookie cleared

## Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Apply migrations to production D1
npm run db:migrate:prod
```

## License

MIT
