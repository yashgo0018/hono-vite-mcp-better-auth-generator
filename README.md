# Project Builder

A powerful CLI tool to scaffold full-stack projects with modern technologies including Cloudflare Workers, Hono, Drizzle ORM, Vite, React 19, Better Auth, and more.

## Features

- **Interactive CLI** - Guided project setup with beautiful prompts
- **Monorepo Structure** - Bun workspaces with catalog dependencies
- **Cloudflare Workers** - Serverless backend with Hono framework
- **Modern Frontend** - Vite + React 19 + Tailwind CSS v4 + shadcn/ui ready
- **Type-Safe Database** - Drizzle ORM with PostgreSQL + Cloudflare Hyperdrive
- **Better Auth** - Complete authentication with session management
- **Google OAuth** - One-question setup for Google sign-in
- **Organizations** - Role-based multi-tenant organization support
- **Frontend Auth** - Login/signup/dashboard pages + Navbar + AuthGuard out of the box
- **MCP Server** - Model Context Protocol server with optional OAuth 2.0
- **KV Storage** - Optional Cloudflare KV with automated namespace creation
- **R2 Object Storage** - Optional Cloudflare R2 buckets with automated creation
- **Observability** - Optional Cloudflare logs and analytics
- **CI/CD Ready** - GitHub Actions workflows with automated environment setup
- **Automation Scripts** - One-command Cloudflare and GitHub configuration
- **TypeScript First** - Full type safety across the stack
- **Developer Experience** - Biome for linting and formatting, per-package `.gitignore` files

## Installation

### Global Installation

```bash
# Clone the repository
git clone <repository-url>
cd project-builder

# Install dependencies
bun install

# Link globally
bun link

# Now you can use it anywhere
create-project
```

### Direct Usage

```bash
git clone <repository-url>
cd project-builder
bun install
bun src/index.ts
```

## Usage

Simply run the CLI and follow the interactive prompts:

```bash
create-project
```

Or if running directly:

```bash
bun src/index.ts
```

### Configuration Options

The CLI will ask you for:

1. **Project Name** - Lowercase alphanumeric with dashes
2. **Description** - Brief description of your project
3. **Author** - Your name
4. **Package Manager** - Choose from Bun, npm, pnpm, or Yarn
5. **Include Backend** - Cloudflare Workers + Hono API
   - **Include Database** - Drizzle ORM with PostgreSQL
     - **Include Auth** - Better Auth authentication
       - **Include Google Auth** - Google OAuth social provider
       - **Include Organizations** - Multi-tenant organization support
   - **Include KV Namespace** - Cloudflare KV for key-value storage
   - **Include R2 Bucket** - Cloudflare R2 for object storage
   - **Include Observability** - Cloudflare logs and analytics
6. **Include Frontend** - Vite + React application
7. **Include MCP Server** - Model Context Protocol server
   - **Include MCP OAuth** - OAuth 2.0 for MCP authentication
   - **Include MCP Web Components** - ChatGPT interactive widgets
8. **Include GitHub Actions** - CI/CD workflows

## Generated Project Structure

```
your-project/
├── apps/
│   ├── backend/          # Cloudflare Workers API (optional)
│   │   ├── src/
│   │   │   ├── index.ts           # Hono app entry point
│   │   │   ├── auth.ts            # Better Auth config (if enabled)
│   │   │   ├── auth-with-env.ts   # Auth config with env bindings (if enabled)
│   │   │   ├── env.ts             # Cloudflare env schema
│   │   │   ├── routes/            # API routes
│   │   │   ├── mcp/               # MCP server (if enabled)
│   │   │   └── lib/               # Middlewares & utilities
│   │   ├── wrangler.json
│   │   └── package.json
│   └── web/              # Vite + React frontend (optional)
│       ├── src/
│       │   ├── main.tsx           # React entry point
│       │   ├── App.tsx            # Root component + routing
│       │   ├── context/           # AuthContext & AuthProvider (if auth)
│       │   ├── routes/
│       │   │   ├── auth/          # Login & signup pages (if auth)
│       │   │   ├── dashboard/     # Protected dashboard (if auth)
│       │   │   └── layouts/       # AuthGuard (if auth)
│       │   ├── components/
│       │   │   └── Navbar.tsx     # Scroll-aware navbar (if auth)
│       │   └── lib/               # auth-client.ts, api.ts
│       ├── index.html
│       ├── vite.config.ts
│       └── package.json
├── packages/
│   ├── db/               # Drizzle ORM (optional)
│   │   ├── src/
│   │   │   ├── index.ts           # DB factory
│   │   │   ├── schema.ts          # Database schema
│   │   │   └── auth-schema.ts     # Better Auth tables (stub, replaced by auth:generate)
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   ├── utils/            # Shared utilities
│   └── web-components/   # ChatGPT widgets (if MCP web components)
├── .github/
│   └── workflows/        # CI/CD (optional)
│       ├── ci.yml
│       ├── deploy-backend.yml
│       ├── deploy-web.yml
│       └── db-migrate.yml
├── scripts/
│   ├── install-cloudflare.sh  # Create KV/R2 resources
│   └── setup-github-env.sh    # Configure GitHub secrets/vars
├── package.json          # Root workspace config with catalog
├── tsconfig.base.json
├── biome.json
└── README.md
```

## Tech Stack

### Backend
- **Runtime**: Cloudflare Workers
- **Framework**: Hono (lightweight, fast, edge-compatible)
- **Database**: Drizzle ORM with PostgreSQL + Cloudflare Hyperdrive
- **Auth**: Better Auth (JWT, organization, oauthProvider plugins)
- **KV Storage**: Cloudflare KV (optional)
- **Object Storage**: Cloudflare R2 (optional)
- **Observability**: Cloudflare Logs & Analytics (optional)
- **Validation**: Zod

### Frontend
- **Build Tool**: Vite 7
- **Framework**: React 19
- **Styling**: Tailwind CSS v4
- **Routing**: React Router v7
- **State Management**: TanStack Query
- **Forms**: React Hook Form
- **UI Components**: shadcn/ui ready
- **Icons**: Lucide React
- **Auth Client**: Better Auth client with session context
- **Type-Safe API**: Hono RPC Client

### Development Tools
- **Package Manager**: Bun (or npm/pnpm/yarn)
- **Linting/Formatting**: Biome
- **Type Checking**: TypeScript 5.9
- **Monorepo**: Bun Workspaces with Catalog

### Infrastructure
- **Hosting**: Cloudflare Workers + Pages
- **CI/CD**: GitHub Actions with automated secret/variable management
- **Database**: PostgreSQL with Cloudflare Hyperdrive (optional)
- **KV Storage**: Cloudflare KV with automated namespace creation (optional)
- **Object Storage**: Cloudflare R2 with automated bucket creation (optional)
- **Monitoring**: Cloudflare Observability (optional)

## Authentication

When Better Auth is enabled, the generated project includes a complete auth flow:

### Backend
- `apps/backend/src/auth.ts` — Better Auth config with:
  - `advanced.database.generateId: "uuid"` always set
  - `organization()` plugin when organizations enabled
  - `jwt()` + `oauthProvider()` + `disabledPaths: ["/token"]` when MCP OAuth enabled
  - `socialProviders.google` when Google Auth enabled

### Frontend
- **Pages**: `/auth/login`, `/auth/signup`, `/dashboard`
- **AuthProvider**: fetches session on mount, listens for session changes via `$sessionSignal`
- **AuthGuard**: redirects unauthenticated users to login, saves `redirectAfterAuth` in sessionStorage
- **Navbar**: scroll-aware frosted glass, shows Sign in/Get started or Dashboard/Sign out based on auth state, hidden on `/dashboard`

### Google OAuth Setup
1. Create credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Set Authorized redirect URI to `http://localhost:8787/api/auth/callback/google`
3. Add to `apps/backend/.env`:
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

## Organizations

When organizations are enabled:
- Better Auth `organization()` plugin is configured
- Role-based access: owner / admin / member
- Active organization tracked per-session
- MCP tools `list_organizations` and `switch_organization` added (if MCP enabled)
- `auth:generate` will include organization tables in the schema

## MCP Server

When MCP is enabled, the project includes a Model Context Protocol server at `/mcp`:

- Tools: `get_user`, `list_records`, `create_record` (+ org tools if organizations enabled)
- Resources: `doc://app/getting-started`
- OAuth 2.0 authentication flow (if MCP OAuth enabled)
- Web components for ChatGPT integration (if MCP web components enabled)

## Available Scripts (in generated project)

- `bun run dev` - Start development servers
- `bun run build` - Build for production
- `bun run auth:generate` - Generate Better Auth schema from auth config (if auth + database)
- `bun run db:migrate` - Run database migrations (if database)
- `bun run lint` - Check code quality
- `bun run lint:fix` - Fix linting issues
- `bun run format` - Format code
- `bun run typecheck` - Run TypeScript type checking

## Automation Scripts

### Cloudflare Resources Setup

```bash
./scripts/install-cloudflare.sh
```

Creates KV namespaces and/or R2 buckets for staging and production, and updates `wrangler.json` automatically.

**Prerequisites**: `wrangler` CLI installed and authenticated (`wrangler login`)

### GitHub Environment Setup

```bash
./scripts/setup-github-env.sh
```

Configures GitHub Actions secrets and variables for staging and production environments.

**What it configures**:
- `CLOUDFLARE_API_TOKEN` — For deployments
- `DATABASE_URL` — PostgreSQL connection string (if database)
- `BETTER_AUTH_SECRET` — Auth secret (if auth)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth (if Google Auth)
- `APP_ENV`, `API_ORIGIN`, `WEB_ORIGIN`, `VITE_API_ORIGIN`

## Deployment

### Backend (Cloudflare Workers)

```bash
cd apps/backend
wrangler deploy
```

### Frontend (Cloudflare Pages)

```bash
cd apps/web
bun run build
wrangler pages deploy dist --project-name your-project-web
```

### Automated Deployment

GitHub Actions workflows included:
- Push to `main` → Deploy to staging
- Push to `prod` → Deploy to production

## Configuration Features

| Feature | Details |
|---------|---------|
| Backend | Cloudflare Workers, Hono API, CORS, type-safe routes |
| Frontend | Vite 7, React 19, Tailwind CSS v4, React Router v7 |
| Database | Drizzle ORM, PostgreSQL schema, migrations |
| Better Auth | Session management, email/password, JWT support |
| Google OAuth | Social provider via Better Auth |
| Organizations | Role-based multi-tenant support |
| MCP Server | AI assistant integration with tools and resources |
| MCP OAuth | OAuth 2.0 for secure MCP access |
| KV Namespace | Cloudflare KV with automated namespace creation |
| R2 Bucket | Cloudflare R2 with automated bucket creation |
| Observability | Cloudflare logs and analytics |
| GitHub Actions | CI/CD, linting, type checking, deployments |

## Troubleshooting

### auth:generate must run before db:migrate

Better Auth generates the auth schema (`packages/db/src/auth-schema.ts`) from your auth config. The generated file contains placeholder `any`-typed exports until you run `auth:generate`. Always run it before the first migration.

### CORS Issues

The backend includes CORS middleware configured to accept credentials. Ensure:
- Frontend makes requests with `credentials: "include"`
- Backend CORS allows the frontend origin

### Module Resolution Issues

If you encounter module resolution errors:
1. Check `tsconfig.base.json` has `"moduleResolution": "Bundler"`
2. Verify workspace dependencies use `workspace:*` protocol
3. Run `bun install` to refresh dependencies

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
