# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

- Always reply to the user in Chinese (Simplified).
- Git commit messages must be in English.

## Project Overview

StockPick is a Chinese A-share stock screening dashboard prototype. It is a pure front-end React/Vite SPA with no backend — all market data is procedurally generated from mock logic in `src/data/mock-stocks.ts`. The UI is entirely in Chinese.

## Commands

- `npm run dev` — Start Vite dev server (typically on port 5173). Do not start this unless the user explicitly asks.
- `npm run build` — Type-check (`tsc -b`) then bundle. Run this after code changes to verify.
- `npm run preview` — Preview the production build.
- `npm run postinstall` — Patches `liveline` library for A-share color convention. Runs automatically on `npm install`.

## Architecture

**Single-file monolith:** The entire application lives in `src/App.tsx` (~1400 lines). All components, hooks, and utility functions are co-located there. No routing, no state management library — just `useState`/`useMemo`.

**Key source files:**
- `src/App.tsx` — All UI components and the `useLiveMockStock` hook (real-time price simulation at 850ms ticks)
- `src/types/stock.ts` — TypeScript interfaces (`StockCandidate`, `StockDailyRecord`, etc.)
- `src/data/mock-stocks.ts` — 10 seed stocks with 28-day procedural OHLC history
- `src/components/ui/` — shadcn/ui-style local primitives (Badge, Button, Card, Separator)
- `src/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `src/styles/globals.css` — Tailwind CSS v4 with CSS custom properties for theming

**Styling:** Tailwind CSS v4 via `@tailwindcss/vite` plugin. Light theme uses `:root`; dark mode toggles via `.dark` class on `<html>`. The `@` path alias maps to `./src`.

**Charting:** Uses the `liveline` library (v0.0.7) for candlestick and line charts. The postinstall script `scripts/patch-liveline-a-share-colors.mjs` swaps green/red colors in liveline's source to match A-share convention — do not remove this script.

**UI components:** Local shadcn/ui primitives using Base UI, `class-variance-authority`, and `cn()`.

## Product Constraints

- A-share color convention: red = price up, green = price down (`--stock-up` / `--stock-down` CSS variables).
- Keep the dashboard as the first screen — no marketing or landing pages.
- Trading-tool aesthetic: high information density, scannable, clear status indicators.
- The four stock list columns (初筛/已选/白名单/黑名单) support HTML5 drag-and-drop between them.
- Do not add runtime dependencies without user confirmation.
- Do not replace mock data with real APIs unless explicitly asked.
- Before modifying chart behavior, verify `liveline`'s actual API and current usage.
- Preserve the existing single-page structure unless the user requests routing or module splits.

## Verification

- Run `npm run build` after code changes.
- UI/interaction changes: user will manually inspect in the browser — do not start the dev server or do browser verification unprompted.
- Doc-only changes: verify with `git diff --check`.
- If a verification command fails, explain the specific reason in your reply.
