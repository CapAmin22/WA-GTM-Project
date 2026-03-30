# WA GTM Project

WhatsApp Go-To-Market Engine with Dynamic Account Scaling.

## Architecture

| Component | Location | Tech | Hosting |
|-----------|----------|------|---------|
| Dashboard | `apps/dashboard` | Next.js 14 (App Router) | Vercel |
| Worker | `apps/worker` | Node.js + Baileys | Oracle Cloud VPS |
| Shared | `packages/shared` | Supabase client + types | — |
| Database | — | PostgreSQL | Supabase |

## Getting Started

### Prerequisites
- Node.js 20+
- npm 9+

### Install
```bash
npm install
```

### Dashboard (development)
```bash
npm run dev:dashboard
# Opens at http://localhost:3000
```

### Worker (development)
```bash
npm run dev:worker
```

## Project Structure
```
WA-GTM-Project/
├── apps/
│   ├── dashboard/     # Next.js admin dashboard
│   └── worker/        # Baileys WhatsApp worker
├── packages/
│   └── shared/        # Shared Supabase client, types, constants
├── supabase/
│   └── migrations/    # SQL migration scripts
├── package.json       # Root workspace config
└── .env.example
```

## Environment Setup

Copy `.env.example` and configure:
- **Dashboard**: `apps/dashboard/.env.local`
- **Worker**: `apps/worker/.env`
