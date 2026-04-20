# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

WhatsApp Go-To-Market Engine with Dynamic Account Scaling. This is a monorepo with two apps and one shared package.

| Component | Location | Tech |
|-----------|----------|------|
| Dashboard | `apps/dashboard` | React 18 + Vite + TypeScript + shadcn/ui |
| Worker | `apps/worker` | Node.js + Baileys (WhatsApp Web API) |
| Shared | `packages/shared` | Supabase client + types + constants |
| Database | `supabase/migrations/` | PostgreSQL via Supabase |

## Commands

Install all workspaces from root:
```bash
npm install
```

### Dashboard
```bash
npm run dev:dashboard          # Dev server at http://localhost:3000
npm run build:dashboard        # Production build
npm run lint                   # ESLint (dashboard only)

# From apps/dashboard directly:
npm run test                   # Vitest (run once)
npm run test:watch             # Vitest (watch mode)
```

### Worker
```bash
npm run dev:worker             # Node watch mode (hot reload)
npm run start:worker           # Production start
```

## Architecture

### Worker (`apps/worker`)
The worker is a single long-running Node.js process. All logic lives in `src/lib/client-manager.js` — `ClientManager` class. It:

1. **Starts** by fetching all non-archived `wa_accounts` from Supabase and calling `initSocket()` for each.
2. **Scales dynamically** via Supabase Realtime (`postgres_changes` on `wa_accounts`). New inserts trigger `handleAccountInsert`; updates trigger `handleAccountUpdate` (handles archiving and re-pair).
3. **Falls back** to polling every 30s (`_startPolling`) when Realtime drops.
4. **Runs campaigns** via `_startCampaignRunner` — polls `message_queue` table every 10s for `status='pending'` rows with `assigned_account_id`, sends via the correct Baileys socket, applies Spintax randomization, jitter delays, composing presence simulation, and writes to `send_logs` after each send.
5. **Reconnects** with exponential backoff (3s→60s cap, 5 max retries). Status codes 401 (logged out) and 440 (replaced) do NOT reconnect.

Auth files are stored as `./auth_info_<accountId>/` directories in the worker's CWD. These must be preserved between restarts.

The worker uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS), so it must never be exposed to clients.

### Dashboard (`apps/dashboard`)
React SPA using React Router v6 with protected routes. `AuthProvider` (`src/contexts/AuthContext.tsx`) wraps the whole app and gates routes via `PrivateRoute` / `PublicOnlyRoute`.

Data fetching uses **TanStack Query** (`@tanstack/react-query`). Supabase client is at `src/integrations/supabase/client.ts` with full TypeScript types in `src/integrations/supabase/types.ts`.

UI components are **shadcn/ui** (Radix primitives + Tailwind). Add new components via `npx shadcn-ui@latest add <component>`.

### Shared Package (`packages/shared`)
Plain JS (no bundler). Exports:
- `createBrowserClient` / `createServerSupabaseClient` — from `supabase.js`
- `ACCOUNT_STATUS`, `CONNECTION_STATUS`, `USER_ROLES`, `ROLE_HIERARCHY`, `TABLES`, `hasPermission` — from `constants.js`

Role hierarchy: `super_admin(4) > admin(3) > operator(2) > viewer(1)`. Use `hasPermission(userRole, requiredRole)` for access checks.

### Database Schema
Single source of truth: `supabase/migrations/APPLY_ALL.sql` (combined 004+005). Key tables:
- `wa_accounts` — WhatsApp accounts: `status`, `connection_status`, `pairing_qr`, `is_archived`, daily counters
- `message_queue` — per-recipient send jobs: `status` (`pending`→`processing`→`sent`/`failed`), `assigned_account_id`, `attempt_count`
- `campaigns` — campaign config + counters (`sent_count`, `failed_count`, `total_recipients`)
- `contacts` — audience: `phone`, `tags[]`, `is_blacklisted`, `total_replies`
- `contact_segments` — tag-based filters with `filter_rules` JSONB
- `message_templates` — Spintax body templates
- `ab_experiments` + `ab_variants` — A/B test structure and per-variant counters
- `send_logs` — immutable delivery record per send attempt with `latency_ms`
- `system_config` — key/value JSONB runtime config (exact keys defined in seed data)
- `baileys_sessions`, `baileys_keys` — Baileys Signal protocol auth (worker only, denied to dashboard)

## Environment Variables

**Dashboard** (`apps/dashboard/.env`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` — anon/public key
- `VITE_SUPABASE_PROJECT_ID`

**Worker** (`apps/worker/.env`):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (bypasses RLS)
- `LOG_LEVEL` (optional, default: `info`)

## Current Status

- **Supabase**: Connected to `https://vihvqnuqhrhkfmfleqfv.supabase.co`. All 10 tables live with RLS + helper functions applied.
- **Dashboard**: Running on `http://localhost:8080`. All pages wired to real Supabase data.
- **Worker**: Running, connects to Supabase via service role key, generates pairing QR for each `wa_account`.

