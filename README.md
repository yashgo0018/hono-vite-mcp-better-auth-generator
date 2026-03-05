# Project Builder

A powerful CLI tool to scaffold full-stack projects with modern technologies including Cloudflare Workers, Hono, Drizzle ORM, Vite, React 19, Better Auth, and more.

## Features

- 🚀 **Interactive CLI** - Guided project setup with beautiful prompts
- 📦 **Monorepo Structure** - Bun workspaces with catalog dependencies
- ⚡ **Cloudflare Workers** - Serverless backend with Hono framework
- 🎨 **Modern Frontend** - Vite + React 19 + Tailwind CSS v4
- 🗄️ **Type-Safe Database** - Drizzle ORM with PostgreSQL
- 🔐 **Better Auth** - Complete authentication solution
- 🔄 **CI/CD Ready** - GitHub Actions workflows included
- 🎯 **TypeScript First** - Full type safety across the stack
- 🛠️ **Developer Experience** - Biome for linting and formatting

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
# Clone and run directly
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
6. **Include Frontend** - Vite + React application
7. **Include Database** - Drizzle ORM with PostgreSQL
8. **Include Better Auth** - Authentication system
9. **Include GitHub Actions** - CI/CD workflows

## Generated Project Structure

```
your-project/
├── apps/
│   ├── backend/          # Cloudflare Workers API (optional)
│   │   ├── src/
│   │   │   ├── index.ts       # Hono app entry point
│   │   │   ├── auth.ts        # Better Auth config (if enabled)
│   │   │   ├── env.ts         # Environment schema
│   │   │   ├── routes/        # API routes
│   │   │   └── lib/           # Middlewares & utilities
│   │   ├── wrangler.toml      # Cloudflare config
│   │   └── package.json
│   └── web/              # Vite + React frontend (optional)
│       ├── src/
│       │   ├── main.tsx       # React entry point
│       │   ├── App.tsx        # Root component
│       │   ├── auth.ts        # Better Auth client (if enabled)
│       │   ├── api.ts         # Hono RPC client (if backend enabled)
│       │   └── components/    # React components
│       ├── index.html
│       ├── vite.config.ts
│       └── package.json
├── packages/
│   ├── db/               # Drizzle ORM (optional)
│   │   ├── src/
│   │   │   ├── index.ts       # DB factory
│   │   │   ├── schema.ts      # Database schema
│   │   │   └── auth-schema.ts # Better Auth tables (if enabled)
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   └── utils/            # Shared utilities
│       ├── src/
│       │   └── index.ts
│       └── package.json
├── .github/
│   └── workflows/        # CI/CD (optional)
│       ├── ci.yml             # Continuous Integration
│       ├── deploy-backend.yml # Backend deployment
│       ├── deploy-web.yml     # Frontend deployment
│       └── db-migrate.yml     # Database migrations
├── package.json          # Root workspace config
├── tsconfig.base.json    # Shared TypeScript config
├── biome.json           # Linting & formatting
└── README.md

```

## Tech Stack

### Backend
- **Runtime**: Cloudflare Workers
- **Framework**: Hono (lightweight, fast, edge-compatible)
- **Database**: Drizzle ORM with PostgreSQL
- **Auth**: Better Auth (if enabled)
- **Validation**: Zod

### Frontend
- **Build Tool**: Vite 7
- **Framework**: React 19
- **Styling**: Tailwind CSS v4
- **Routing**: React Router v7
- **Type-Safe API**: Hono RPC Client

### Development Tools
- **Package Manager**: Bun (or npm/pnpm/yarn)
- **Linting/Formatting**: Biome
- **Type Checking**: TypeScript 5.9
- **Monorepo**: Bun Workspaces with Catalog

### Infrastructure
- **Hosting**: Cloudflare Workers + Pages
- **CI/CD**: GitHub Actions
- **Database**: PostgreSQL with Cloudflare Hyperdrive (optional)

## Getting Started with Generated Project

After generating your project:

1. **Navigate to project directory**:
   ```bash
   cd your-project-name
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Set up environment variables** (if using backend/database):
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   # Edit apps/backend/.env with your configuration
   ```

4. **Run database migrations** (if using database):
   ```bash
   bun run db:migrate
   ```

5. **Start development servers**:
   ```bash
   bun run dev
   ```

   Your services will be available at:
   - Backend: http://localhost:8787
   - Frontend: http://localhost:5173

## Available Scripts

In the generated project:

- `bun run dev` - Start development servers
- `bun run build` - Build for production
- `bun run db:migrate` - Run database migrations (if database enabled)

## Configuration

### Cloudflare Setup

1. Install Wrangler CLI globally:
   ```bash
   bun add -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Configure secrets (if using Better Auth):
   ```bash
   cd apps/backend
   printf "%s" "$DATABASE_URL" | wrangler secret put DATABASE_URL
   printf "%s" "$BETTER_AUTH_SECRET" | wrangler secret put BETTER_AUTH_SECRET
   ```

### Database Setup

1. Create a PostgreSQL database (e.g., on Neon, Supabase, or local)
2. Add the connection string to `apps/backend/.env`:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   ```
3. Run migrations:
   ```bash
   bun run db:migrate
   ```

### Better Auth Setup

If you included Better Auth, configure OAuth providers in `apps/backend/src/auth.ts`:

```typescript
socialProviders: {
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  },
}
```

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

GitHub Actions workflows are included for automatic deployment:
- Push to `main` → Deploy to staging
- Push to `prod` → Deploy to production

Configure these secrets in your GitHub repository:
- `CLOUDFLARE_API_TOKEN`
- `DATABASE_URL`

## Project Features Based on Configuration

| Configuration | Features Included |
|--------------|-------------------|
| Backend | Cloudflare Workers, Hono API, CORS, Type-safe routes |
| Frontend | Vite, React 19, Tailwind CSS, React Router |
| Database | Drizzle ORM, PostgreSQL schema, Migrations setup |
| Better Auth | User authentication, Session management, OAuth support |
| GitHub Actions | CI/CD, Linting, Type checking, Deployments |

## Development Tips

1. **Hot Reload**: Both frontend and backend support hot reload in development
2. **Type Safety**: Use Hono's RPC client for type-safe API calls from frontend
3. **Monorepo**: Share code between apps using workspace packages
4. **Catalog**: Use the catalog feature for consistent dependency versions
5. **Biome**: Run `bunx biome check .` before committing

## Troubleshooting

### "prepare: false" in Drizzle Config

This is required for Cloudflare Workers compatibility. Don't change it.

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

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ using modern web technologies
