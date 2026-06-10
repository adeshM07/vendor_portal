# Link2Build Vendor Portal — Development Guide

This document explains how the **Link2Build Vendor Portal** is built, what tools and packages are used, and how the project is organized for development.

---

## 1. Project Overview

**Link2Build Vendor Portal** is a two-page web application for construction marketplace vendors. It allows vendors to:

1. **Log in** using a simulated mobile OTP flow
2. **View a dashboard** with operational insights: booking requests, work progress, and machinery bottlenecks

There is **no backend or database** in this version. Authentication and dashboard data are handled with **client-side mock state** so the app is fully interactive immediately after setup.

| Page | Route | Purpose |
|------|-------|---------|
| Vendor Login | `/` | Mobile number + OTP authentication |
| Vendor Dashboard | `/dashboard` | Operational overview after login |

---

## 2. Development Kit & Tech Stack

### Core framework

| Technology | Version | Role |
|------------|---------|------|
| **Next.js** | 16.2.7 | React framework with App Router, routing, and build tooling |
| **React** | 19.2.4 | UI library for components and interactive state |
| **TypeScript** | ^5 | Static typing for safer, maintainable code |
| **Tailwind CSS** | ^4 | Utility-first styling and design system |
| **Lucide React** | ^1.17.0 | Premium outline icons (hollow style, no solid blobs) |

### Tooling (dev dependencies)

| Package | Purpose |
|---------|---------|
| `@tailwindcss/postcss` | PostCSS plugin to compile Tailwind CSS v4 |
| `@types/node`, `@types/react`, `@types/react-dom` | TypeScript type definitions |
| `eslint` + `eslint-config-next` | Code linting aligned with Next.js best practices |

### Runtime requirements

- **Node.js** 18.18+ (recommended: 20+)
- **npm** (comes with Node.js)

### Fonts

- **Geist Sans** and **Geist Mono** — loaded via `next/font/google` in `src/app/layout.tsx` for crisp, modern typography.

---

## 3. Installed Packages — What & Why

### Production dependencies (`dependencies`)

```json
{
  "next": "16.2.7",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "lucide-react": "^1.17.0"
}
```

| Package | Why it was chosen |
|---------|-------------------|
| `next` | File-based routing (`/`, `/dashboard`), server/client components, optimized builds, and `next dev` for local development |
| `react` / `react-dom` | Component model, hooks (`useState`, `useEffect`), and client-side interactivity for login OTP flow and auth checks |
| `lucide-react` | Lightweight, consistent outline icons (`Building2`, `Phone`, `AlertTriangle`, etc.) matching the premium dark UI |

### Dev dependencies (`devDependencies`)

```json
{
  "@tailwindcss/postcss": "^4",
  "tailwindcss": "^4",
  "typescript": "^5",
  "@types/node": "^20",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "eslint": "^9",
  "eslint-config-next": "16.2.7"
}
```

| Package | Why it was chosen |
|---------|-------------------|
| `tailwindcss` + `@tailwindcss/postcss` | Dark-mode-first styling with utility classes (`bg-zinc-950`, `border-zinc-800`, etc.) |
| `typescript` | Type-safe props, mock data interfaces, and better IDE support |
| `@types/*` | Type hints for Node and React APIs |
| `eslint` + `eslint-config-next` | Catch common React/Next.js issues during development |

### How packages were installed

The project was scaffolded with:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Then the icon library was added:

```bash
npm install lucide-react
```

---

## 4. Project Structure

```
vender_updates/
├── src/
│   ├── app/                          # Next.js App Router (pages & layout)
│   │   ├── layout.tsx                # Root layout, fonts, metadata
│   │   ├── globals.css               # Global styles, CSS variables, animations
│   │   ├── page.tsx                  # PAGE 1: Login (/)
│   │   └── dashboard/
│   │       └── page.tsx              # PAGE 2: Dashboard (/dashboard)
│   │
│   ├── components/
│   │   ├── login/
│   │   │   ├── LoginCard.tsx         # Two-step OTP login UI + logic
│   │   │   └── OtpInput.tsx          # 6-digit OTP input with paste support
│   │   ├── dashboard/
│   │   │   ├── DashboardContent.tsx  # Auth guard + dashboard layout
│   │   │   ├── DashboardHeader.tsx   # Branding, user info, sign out
│   │   │   ├── BookingRequestsTable.tsx
│   │   │   ├── WorkProgressSection.tsx
│   │   │   └── BottleneckAlerts.tsx
│   │   └── ui/
│   │       ├── Card.tsx              # Reusable card shell + header
│   │       └── StatusBadge.tsx       # Pending / Confirmed / In Review badges
│   │
│   └── lib/
│       ├── auth.ts                   # Session helpers (sessionStorage)
│       └── mock-data.ts              # Mock bookings, progress, alerts
│
├── public/                           # Static assets (if any)
├── package.json                      # Dependencies and npm scripts
├── tsconfig.json                     # TypeScript config, `@/*` path alias
├── next.config.ts                    # Next.js configuration
├── postcss.config.mjs                # Tailwind PostCSS setup
├── eslint.config.mjs                 # ESLint rules
└── DEVELOPMENT.md                    # This file
```

### Path alias

Imports use `@/` to reference `src/`:

```ts
import { LoginCard } from "@/components/login/LoginCard";
import { bookingRequests } from "@/lib/mock-data";
```

Configured in `tsconfig.json`:

```json
"paths": {
  "@/*": ["./src/*"]
}
```

---

## 5. Architecture & Data Flow

### High-level flow

```
┌─────────────┐     Send OTP      ┌─────────────┐    Verify OTP     ┌──────────────────┐
│  Login (/)  │ ───────────────►  │  OTP Step   │ ───────────────►  │ Dashboard        │
│  Mobile #   │                   │  6 digits   │   sessionStorage  │ (/dashboard)     │
└─────────────┘                   └─────────────┘                   └──────────────────┘
                                                                          │
                                                                          ▼
                                                                  mock-data.ts
                                                                  (bookings, progress, alerts)
```

### Authentication (mock)

- **File:** `src/lib/auth.ts`
- **Storage:** `sessionStorage` (browser tab session only)
- **Key:** `link2build_vendor_auth`
- **Flow:**
  1. User enters 10-digit mobile → clicks **Send OTP**
  2. OTP step appears (any 6 digits accepted in this demo)
  3. On verify → `setVendorSession(mobile)` → redirect to `/dashboard`
  4. Dashboard reads session; if missing → redirect to `/`
  5. **Sign out** clears session and returns to login

No real SMS or API calls — delays are simulated with `setTimeout` for realistic UX.

### Mock data

- **File:** `src/lib/mock-data.ts`
- Exports typed arrays:
  - `bookingRequests` — rental requests with status
  - `deploymentProgress` — completion percentages per site
  - `bottleneckAlerts` — stuck/broken machinery alerts

Replace this file or connect to an API when moving to production.

### Server vs client components

| File | Type | Reason |
|------|------|--------|
| `app/page.tsx` | Server | Static shell; renders `LoginCard` |
| `app/dashboard/page.tsx` | Server | Thin wrapper for `DashboardContent` |
| `LoginCard.tsx` | Client (`"use client"`) | `useState`, `useRouter`, form interactions |
| `OtpInput.tsx` | Client | Focus management, keyboard/paste handling |
| `DashboardContent.tsx` | Client | `useEffect` auth check, `sessionStorage` |
| `DashboardHeader.tsx` | Client | Logout button + navigation |
| Dashboard tables/sections | Server | Presentational; receive props only |

---

## 6. Design System

The UI is **dark-mode first** and built for a professional construction/logistics context.

| Token | Usage |
|-------|--------|
| `bg-zinc-950` | Page background |
| `bg-zinc-900/40`–`bg-zinc-900/60` | Cards, inputs (glass effect) |
| `border-zinc-800` | Thin borders (no heavy blocks) |
| `text-zinc-50` / `text-zinc-400` | Primary and secondary text |
| `blue-500` accents | Login actions, focus rings |
| `emerald-500` | Success / verify actions |
| `red-500` | Critical bottleneck alerts |
| `amber-500` | Pending status, lower progress |

### UI patterns

- **Glassmorphism** on login card: `backdrop-blur-xl`, semi-transparent backgrounds
- **Micro-interactions:** `transition-all duration-200`, focus rings, hover states
- **Animations:** `animate-fade-in-up` for OTP step reveal (defined in `globals.css`)
- **Icons:** Lucide outline only, `strokeWidth={1.5}` for a sharp look

---

## 7. Key Files Explained

### `src/app/page.tsx` — Login page

Renders a centered layout with subtle background gradients and the `LoginCard` component.

### `src/components/login/LoginCard.tsx`

- Manages login steps: `"mobile"` → `"otp"`
- Validates 10-digit mobile and 6-digit OTP
- Simulates API delay before step change and redirect

### `src/components/login/OtpInput.tsx`

- Six individual digit inputs
- Supports backspace navigation, arrow keys, and paste

### `src/components/dashboard/DashboardContent.tsx`

- On mount: checks `getVendorSession()`
- If not logged in → `router.replace("/")`
- Renders header + three dashboard sections from mock data

### `src/lib/mock-data.ts`

- TypeScript interfaces: `BookingRequest`, `DeploymentProgress`, `BottleneckAlert`
- Single source of truth for dashboard content until a backend is added

---

## 8. npm Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Starts development server at **http://localhost:3000** |
| `npm run build` | Production build (TypeScript check + static generation) |
| `npm run start` | Serves the production build (run `build` first) |
| `npm run lint` | Runs ESLint on the codebase |

### Local development

```bash
cd d:\vender_updates
npm install          # First time only
npm run dev          # Start dev server
```

Open **http://localhost:3000** in your browser.

> If you see `ERR_CONNECTION_REFUSED`, the dev server is not running. Start it with `npm run dev` and wait until you see `Ready`.

### Test login flow

1. Enter any **10-digit** mobile number (e.g. `9876543210`)
2. Click **Send OTP**
3. Enter any **6-digit** code
4. Click **Verify & Login** → redirects to `/dashboard`

---

## 9. Adding Features Later

Suggested extension points:

| Goal | Where to change |
|------|-----------------|
| Real OTP API | `LoginCard.tsx` — replace `setTimeout` with `fetch` to your auth service |
| Persistent auth | `auth.ts` — swap `sessionStorage` for cookies or JWT |
| Live dashboard data | `mock-data.ts` → API routes or server actions in `src/app/api/` |
| New dashboard widgets | Add component under `src/components/dashboard/`, import in `DashboardContent.tsx` |
| Environment variables | `.env.local` for API URLs and secrets (do not commit secrets) |

---

## 10. Summary

| Area | Choice |
|------|--------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React (outline) |
| Auth | Mock OTP + `sessionStorage` |
| Data | Mock TypeScript modules |
| Pages | Exactly 2: Login + Dashboard |
| Architecture | Component-driven, `src/` layout, `@/*` imports |

This setup keeps the codebase **simple, modular, and production-shaped** while remaining easy to extend with real APIs and authentication when needed.
