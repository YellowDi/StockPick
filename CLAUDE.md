# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

- Always reply to the user in Chinese (Simplified).
- Git commit messages must be in English.

## Project Overview

StockPick is a Chinese A-share stock screening dashboard prototype. It is a React/TypeScript SPA that connects to a backend API at `http://192.168.2.16:1889/api/v1` for authentication, strategy scanning, stock filter lists, and selection history. The UI is entirely in Chinese.

## Commands

- `npm run dev` — Start Vite dev server (typically on port 5173). Do not start this unless the user explicitly asks.
- `npm run build` — Type-check (`tsc -b`) then bundle. Run this after code changes to verify.
- `npm run preview` — Preview the production build.
- `npm run postinstall` — Patches `liveline` library for A-share color convention. Runs automatically after dependency installs.

## Architecture

**App shell:** `src/App.tsx` manages auth state and renders either `LoginPage` or lazy-loaded `StockDashboard`. No routing library — screen switching is a boolean toggle.

**Dashboard monolith:** The entire stock dashboard lives in `src/features/stock-board/stock-dashboard.tsx` (~5000+ lines). It contains all UI components, a `useReducer` with ~30 action variants, helper functions, and responsive layout logic for both mobile and desktop.

**API layer:**
- `src/lib/auth-api.ts` — JWT login/token management, stored in `localStorage` with custom event-based expiry notification.
- `src/lib/stock-api.ts` — Typed async functions for all backend endpoints (stock list, filter lists, strategy scan/config CRUD, selection batch/record CRUD).

**Key source files:**
- `src/features/stock-board/stock-dashboard.tsx` — Main dashboard (charts, stock lists, modals, state management)
- `src/features/strategy-switch/strategy-config.ts` — StrategyConfig type and defaults
- `src/features/strategy-switch/strategy-switch-button.tsx` — Strategy config modal
- `src/components/login-page.tsx` — Login form with WebGL thread animation
- `src/components/threads.tsx` — OGL/WebGL shader-based animated background
- `src/types/stock.ts` — `StockCandidate`, `StockDailyRecord`, `StockListKey`
- `src/data/stock-list-meta.ts` — Stock list labels and description metadata
- `src/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `src/styles/globals.css` — Tailwind CSS v4 with CSS custom properties for theming

**Styling:** Tailwind CSS v4 via `@tailwindcss/vite` plugin. Dark mode via `.dark` class on `<html>` (currently hardcoded to dark). The `@` path alias maps to `./src`.

**Charting:** Uses the `liveline` library (v0.0.7) for candlestick and line charts. The postinstall script `scripts/patch-liveline-a-share-colors.mjs` swaps green/red colors in liveline's source to match A-share convention — do not remove this script.

**UI components:** HeroUI v3 via `@heroui/react` and `@heroui/styles`. Icons use Remix Icon (`@remixicon/react`), not lucide-react.

**Package manager:** pnpm.

## Product Constraints

- A-share color convention: red = price up, green = price down (`--stock-up` / `--stock-down` CSS variables).
- Keep the dashboard as the first screen — no marketing or landing pages.
- Trading-tool aesthetic: high information density, scannable, clear status indicators.
- The four stock list columns (初筛/已选/白名单/黑名单) support HTML5 drag-and-drop between them.
- Do not add runtime dependencies without user confirmation.
- Do not add mock data in place of existing backend APIs unless explicitly asked.
- Before modifying chart behavior, verify `liveline`'s actual API and current usage.
- Preserve the existing single-page structure unless the user requests routing or module splits.

## Verification

- Run `npm run build` after code changes.
- UI/interaction changes: user will manually inspect in the browser — do not start the dev server or do browser verification unprompted.
- Doc-only changes: verify with `git diff --check`.
- If a verification command fails, explain the specific reason in your reply.
