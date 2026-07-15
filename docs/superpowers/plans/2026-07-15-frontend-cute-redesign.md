# RingDog Frontend Cute Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the entire RingDog frontend (`apps/frontend`, Next.js 15) from bare-bones black-and-white CSS into a cute, playful keyring-shop look, using Tailwind CSS, a coral/mint palette, Jua + Noto Sans KR fonts, and hand-drawn SVG product icons in place of the current blank image placeholders.

**Architecture:** Introduce Tailwind CSS with a custom theme (colors, shadows, fonts) directly in `tailwind.config.ts` — no additional UI component library. Restyle every page/component in place using Tailwind utility classes, replacing the hand-written `globals.css` rules they currently use. Add a small `ProductIcon` component that maps a product's existing `tags` array (`[adjective, subject]`, already set at seed time) to one of 15 hand-drawn SVG motif icons plus a CSS-only material/style treatment, and wire it into `ProductCard` and the product detail page in place of the gray placeholder.

**Tech Stack:** Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS v3 (new), `next/font/google` (new), no additional runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-07-15-frontend-cute-redesign-design.md`

## Global Constraints

- Package manager is pnpm workspaces; the frontend package is `@ringdog/frontend` at `apps/frontend`. Run its scripts from the repo root as `pnpm --filter @ringdog/frontend run <script>` (this is the same pattern the existing `Dockerfile` already uses).
- Tailwind CSS only — do not add shadcn/ui or any other component library.
- No dark mode.
- No backend/API changes. The only non-pure-styling change is `ProductIcon`'s tag-matching logic, which is presentation-only (no network/API calls).
- All 60 seeded products (`packages/db/prisma/seed.ts`) have `imageUrl: null` and `tags: [adjective, subject]`. `ProductIcon` must fall back gracefully (a generic keyring icon) if a product's tags don't match any of the known 15 motifs/15 materials, so it never crashes on unexpected data.
- Color tokens: custom `primary` (coral) and `mint` scales, plus a `cream` background color, defined once in `tailwind.config.ts`. Everything else (neutrals, status colors, etc.) uses Tailwind's built-in palette (`stone` for warm neutrals, `amber`/`sky`/etc. for accents) rather than inventing more custom scales.
- Fonts: `next/font/google` loading **Jua** (`--font-jua`, headings/logo only, weight 400) and **Noto Sans KR** (`--font-noto-sans-kr`, body text, weights 400/500/700), both with `subsets: ["latin", "korean"]` so Korean glyphs actually render with the custom font instead of falling back to system fonts.
- Every existing user-facing string/behavior stays exactly the same — this plan only changes markup structure where needed to apply Tailwind classes and CSS-driven icons, never copy or logic.

---

### Task 1: Add the Tailwind CSS toolchain

**Files:**
- Modify: `apps/frontend/package.json`
- Create: `apps/frontend/tailwind.config.ts`
- Create: `apps/frontend/postcss.config.js`
- Modify: `apps/frontend/src/app/globals.css`

**Interfaces:**
- Produces: Tailwind theme tokens consumed by every later task — colors `primary-{50,100,200,300,400,500,600,700,800}`, `mint-{50,100,200,300,400,500,600,700,800}`, `cream`; `boxShadow.soft` / `boxShadow["soft-lg"]`.
- Consumes: nothing (foundation task).

- [ ] **Step 1: Add Tailwind's devDependencies**

Edit `apps/frontend/package.json`'s `devDependencies` block to add:

```json
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
```

(Keep the existing entries; this just adds three new lines alongside `@types/node`, `@types/react`, etc.)

- [ ] **Step 2: Install**

Run: `pnpm install` (from the repo root, `D:/Demo`)
Expected: lockfile updates, no errors.

- [ ] **Step 3: Create `apps/frontend/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#FFF4F1",
          100: "#FFE4DD",
          200: "#FFC7B8",
          300: "#FFA48D",
          400: "#FF8266",
          500: "#FF6A4D",
          600: "#F3512F",
          700: "#CC3D1F",
          800: "#A02F17",
        },
        mint: {
          50: "#F0FBF6",
          100: "#DBF5E9",
          200: "#B7EAD3",
          300: "#8ADFBC",
          400: "#5DCE9F",
          500: "#3AB483",
          600: "#2B9268",
          700: "#217050",
          800: "#1A5740",
        },
        cream: "#FFFBF5",
      },
      boxShadow: {
        soft: "0 8px 24px -6px rgba(255, 106, 77, 0.35)",
        "soft-lg": "0 16px 40px -8px rgba(255, 106, 77, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Create `apps/frontend/postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Replace `apps/frontend/src/app/globals.css`**

Replace the entire file contents with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-cream text-stone-800;
}
```

(This deletes all the old hand-written classes — `.product-card`, `.site-header`, `.chat-widget`, etc. Later tasks restyle every component that used them, so nothing should still reference these class names once this plan is complete. It's fine for pages to look temporarily broken between this step and later tasks.)

- [ ] **Step 6: Verify it builds**

Run: `pnpm --filter @ringdog/frontend run typecheck`
Expected: no errors (this step touches no `.tsx` files, only CSS/config).

Run: `pnpm --filter @ringdog/frontend run dev`
Expected: dev server starts on port 3000 without errors. Visit `http://localhost:3000` — the page will look unstyled/plain (no Tailwind classes applied to components yet), but it should render without a crash or CSS build error. Stop the dev server after confirming.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/package.json apps/frontend/tailwind.config.ts apps/frontend/postcss.config.js apps/frontend/src/app/globals.css pnpm-lock.yaml
git commit -m "feat(frontend): add Tailwind CSS toolchain and brand color tokens"
```

---

### Task 2: Add Jua + Noto Sans KR fonts

**Files:**
- Create: `apps/frontend/src/app/fonts.ts`
- Modify: `apps/frontend/src/app/layout.tsx`
- Modify: `apps/frontend/tailwind.config.ts`

**Interfaces:**
- Consumes: `boxShadow`/color tokens from Task 1 (unchanged).
- Produces: CSS variables `--font-jua` and `--font-noto-sans-kr` set on `<html>`; Tailwind utilities `font-heading` (Jua) and the default `font-sans` (Noto Sans KR), consumed by every later task's headings/logo/body text.

- [ ] **Step 1: Create `apps/frontend/src/app/fonts.ts`**

```ts
import { Jua, Noto_Sans_KR } from "next/font/google";

export const jua = Jua({
  weight: "400",
  subsets: ["latin", "korean"],
  variable: "--font-jua",
  display: "swap",
});

export const notoSansKr = Noto_Sans_KR({
  weight: ["400", "500", "700"],
  subsets: ["latin", "korean"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});
```

- [ ] **Step 2: Extend `apps/frontend/tailwind.config.ts`'s `fontFamily` theme**

Add an import at the top of the file:

```ts
import defaultTheme from "tailwindcss/defaultTheme";
```

Add a `fontFamily` key inside `theme.extend`, alongside the existing `colors` and `boxShadow` keys:

```ts
      fontFamily: {
        sans: ["var(--font-noto-sans-kr)", ...defaultTheme.fontFamily.sans],
        heading: ["var(--font-jua)", "sans-serif"],
      },
```

- [ ] **Step 3: Wire the fonts into `apps/frontend/src/app/layout.tsx`**

Add the import (alongside the existing imports):

```tsx
import { jua, notoSansKr } from "./fonts";
```

Change the `<html>` and `<body>` tags:

```tsx
    <html lang="ko" className={`${jua.variable} ${notoSansKr.variable}`}>
      <body className="min-h-screen bg-cream font-sans text-stone-800 antialiased">
```

(`lang="en"` → `lang="ko"` since all page content is Korean.)

- [ ] **Step 4: Verify**

Run: `pnpm --filter @ringdog/frontend run typecheck`
Expected: no errors.

Run: `pnpm --filter @ringdog/frontend run dev`, visit `http://localhost:3000`, open devtools and inspect `<html>` — it should have two long `__className_...` values in its `class` attribute (one per font). Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/fonts.ts apps/frontend/src/app/layout.tsx apps/frontend/tailwind.config.ts
git commit -m "feat(frontend): load Jua + Noto Sans KR fonts"
```

---

### Task 3: Build the Logo and restyle the Header

**Files:**
- Create: `apps/frontend/src/components/Logo.tsx`
- Create: `apps/frontend/src/app/icon.svg`
- Modify: `apps/frontend/src/components/Header.tsx`

**Interfaces:**
- Consumes: `font-heading`, `primary-*` colors, `shadow-soft` from Tasks 1–2.
- Produces: `Logo` component (`{ className?: string }` props), reused by Task 3 only for now — no other task depends on it directly.

- [ ] **Step 1: Create `apps/frontend/src/components/Logo.tsx`**

```tsx
export function Logo({ className = "h-8 w-8" }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
      <path d="M11 18v3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M20.5 24.5c-3.4-2-5.2-4.1-5.2-6.4a3 3 0 0 1 5.2-2 3 3 0 0 1 5.2 2c0 2.3-1.8 4.4-5.2 6.4Z"
        fill="currentColor"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Create the favicon at `apps/frontend/src/app/icon.svg`**

(Next.js App Router auto-detects `app/icon.svg` and serves it as the site favicon/app icon — no code wiring needed.)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <circle cx="11" cy="11" r="7" stroke="#FF6A4D" stroke-width="2.4" />
  <path d="M11 18v3.5" stroke="#FF6A4D" stroke-width="2.4" stroke-linecap="round" />
  <path d="M20.5 24.5c-3.4-2-5.2-4.1-5.2-6.4a3 3 0 0 1 5.2-2 3 3 0 0 1 5.2 2c0 2.3-1.8 4.4-5.2 6.4Z" fill="#FF6A4D" />
</svg>
```

- [ ] **Step 3: Replace `apps/frontend/src/components/Header.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { clearToken, isLoggedIn } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export function Header(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, [pathname]);

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  function handleLogout(): void {
    clearToken();
    setLoggedIn(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="bg-primary-500 text-white shadow-soft">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-heading text-xl">
          <Logo className="h-8 w-8" />
          RingDog
        </Link>

        <form className="flex min-w-[200px] flex-1 gap-2" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="키워드 검색 (예: 가죽, 에어팟)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 rounded-full border-none px-4 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-white"
          />
          <button
            type="submit"
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-primary-600 transition hover:bg-primary-50"
          >
            검색
          </button>
        </form>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/cart" className="hover:underline">
            장바구니
          </Link>
          {loggedIn ? (
            <>
              <Link href="/orders" className="hover:underline">
                주문내역
              </Link>
              <button type="button" className="hover:underline" onClick={handleLogout}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-white px-3 py-1.5 font-medium text-primary-600 transition hover:bg-primary-50"
              >
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @ringdog/frontend run typecheck && pnpm --filter @ringdog/frontend run lint`
Expected: both pass with no errors.

Run: `pnpm --filter @ringdog/frontend run dev`, visit `http://localhost:3000`. Confirm: the header is a solid coral bar with a keyring+heart logo mark and "RingDog" in the rounded Jua font, a pill-shaped search box, and a browser tab favicon showing the same logo mark. Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/Logo.tsx apps/frontend/src/app/icon.svg apps/frontend/src/components/Header.tsx
git commit -m "feat(frontend): add SVG logo/favicon and restyle Header with Tailwind"
```

---

### Task 4: Build the product icon system

**Files:**
- Create: `apps/frontend/src/components/icons/productIcons.tsx`
- Create: `apps/frontend/src/components/icons/productStyles.ts`
- Create: `apps/frontend/src/components/ProductIcon.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure presentation components); uses Tailwind's built-in `stone`/`amber`/`sky`/`slate`/`fuchsia`/`rose`/`zinc` colors plus `primary`/`mint` from Task 1.
- Produces: `ProductIcon` component — `{ tags: string[]; name: string; className?: string }` → `JSX.Element` — consumed by Tasks 5 and 6 (`ProductCard`, product detail page).

- [ ] **Step 1: Create `apps/frontend/src/components/icons/productIcons.tsx`**

```tsx
type IconProps = { className?: string };

const STROKE_PROPS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function AirpodsIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <rect x="6" y="3" width="5" height="7" rx="2.5" />
      <path d="M8.5 10v6a2 2 0 1 0 4 0" />
      <rect x="13" y="3" width="5" height="7" rx="2.5" />
      <path d="M15.5 10v8a2 2 0 1 0 4 0" />
    </svg>
  );
}

function CatIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M6 8 4 3l4 3" />
      <path d="M18 8l2-5-4 3" />
      <circle cx="12" cy="13" r="7" />
      <circle cx="9.5" cy="12" r="0.5" fill="currentColor" />
      <circle cx="14.5" cy="12" r="0.5" fill="currentColor" />
      <path d="M12 14.5v1" />
      <path d="M9 17c1 1 5 1 6 0" />
    </svg>
  );
}

function DogIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M5 7c-1.5 0-2.5 2-2 5l2 3" />
      <path d="M19 7c1.5 0 2.5 2 2 5l-2 3" />
      <circle cx="12" cy="13" r="7" />
      <circle cx="9.5" cy="12" r="0.5" fill="currentColor" />
      <circle cx="14.5" cy="12" r="0.5" fill="currentColor" />
      <ellipse cx="12" cy="15" rx="1.5" ry="1" fill="currentColor" />
      <path d="M9.5 18c1 .8 3.5 .8 5 0" />
    </svg>
  );
}

function BearIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="12" cy="13" r="7" />
      <circle cx="9.5" cy="12" r="0.5" fill="currentColor" />
      <circle cx="14.5" cy="12" r="0.5" fill="currentColor" />
      <circle cx="12" cy="15" r="1.6" />
      <path d="M12 16.6v0.4" />
    </svg>
  );
}

function AstronautIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="5" />
      <path d="M8 9.5c1-1 6-1 8 0" />
      <path d="M6.5 15.5l-2 2" />
      <path d="M17.5 15.5l2 2" />
    </svg>
  );
}

function CarIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M4 15l1.5-4.5A2 2 0 0 1 7.4 9h9.2a2 2 0 0 1 1.9 1.5L20 15" />
      <path d="M3.5 15h17v2.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V15Z" />
      <circle cx="7.5" cy="18.5" r="1.6" />
      <circle cx="16.5" cy="18.5" r="1.6" />
    </svg>
  );
}

function FlowerIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="12" cy="6.5" r="3" />
      <circle cx="12" cy="17.5" r="3" />
      <circle cx="6.5" cy="12" r="3" />
      <circle cx="17.5" cy="12" r="3" />
      <path d="M12 20v2" />
    </svg>
  );
}

function StarIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M12 3l2.6 5.8 6.2.6-4.7 4.2 1.4 6.2L12 16.9 6.5 19.8l1.4-6.2-4.7-4.2 6.2-.6L12 3Z" />
    </svg>
  );
}

function GlobeIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <path d="M12 4c2.5 2.2 2.5 13.8 0 16" />
      <path d="M12 4c-2.5 2.2-2.5 13.8 0 16" />
      <path d="M5.5 7.5c3.5 1.6 9.5 1.6 13 0" />
      <path d="M5.5 16.5c3.5-1.6 9.5-1.6 13 0" />
    </svg>
  );
}

function CameraIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M9 5l-1.2 2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2.8L15 5H9Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function SoccerBallIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8.5l3 2.2-1.1 3.5H10.1L9 10.7 12 8.5Z" />
      <path d="M12 8.5V5" />
      <path d="M15 10.7l3-1" />
      <path d="M13.9 14.2l1.9 2.8" />
      <path d="M10.1 14.2l-1.9 2.8" />
      <path d="M9 10.7l-3-1" />
    </svg>
  );
}

function BookIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M4 5.5A2 2 0 0 1 6 4h5v16H6a2 2 0 0 1-2-2V5.5Z" />
      <path d="M20 5.5A2 2 0 0 0 18 4h-5v16h5a2 2 0 0 0 2-2V5.5Z" />
      <path d="M11 4v16" />
    </svg>
  );
}

function CoffeeCupIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z" />
      <path d="M16 10.5h1.5a2.2 2.2 0 0 1 0 4.4H16" />
      <path d="M8 5c0 .8.9.8.9 1.6S8 8 8 8" />
      <path d="M11.5 5c0 .8.9.8.9 1.6S11.5 8 11.5 8" />
    </svg>
  );
}

function BicycleIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="6" cy="16" r="3.2" />
      <circle cx="18" cy="16" r="3.2" />
      <path d="M6 16l4-8h4l3 8" />
      <path d="M10 8H8" />
      <path d="M10 8l3.5 8" />
      <path d="M14 8h2.5" />
    </svg>
  );
}

function RocketIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M12 3c2.8 2 4.2 5.2 4.2 8.8 0 1.7-.3 3.3-.9 4.7h-6.6c-.6-1.4-.9-3-.9-4.7C7.8 8.2 9.2 5 12 3Z" />
      <circle cx="12" cy="10" r="1.6" />
      <path d="M9.3 16.5 7 20l3-1.2" />
      <path d="M14.7 16.5 17 20l-3-1.2" />
      <path d="M10 20.5h4" />
    </svg>
  );
}

function KeyringIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="9" cy="8" r="4" />
      <path d="M9 12v2" />
      <rect x="6.5" y="14" width="5" height="6" rx="1.5" />
    </svg>
  );
}

/**
 * Keyed by the seed data's `subject` tag (packages/db/prisma/seed.ts SUBJECTS).
 * "기본" is the fallback used when a product's tags don't match any subject.
 */
export const PRODUCT_ICONS: Record<string, (props: IconProps) => JSX.Element> = {
  에어팟: AirpodsIcon,
  고양이: CatIcon,
  강아지: DogIcon,
  곰돌이: BearIcon,
  우주비행사: AstronautIcon,
  자동차: CarIcon,
  꽃: FlowerIcon,
  별: StarIcon,
  지구본: GlobeIcon,
  카메라: CameraIcon,
  축구공: SoccerBallIcon,
  책: BookIcon,
  커피컵: CoffeeCupIcon,
  자전거: BicycleIcon,
  로켓: RocketIcon,
  기본: KeyringIcon,
};
```

- [ ] **Step 2: Create `apps/frontend/src/components/icons/productStyles.ts`**

```ts
/**
 * Keyed by the seed data's `adjective` tag (packages/db/prisma/seed.ts
 * ADJECTIVES). Each value is a Tailwind class string for the badge behind
 * a product icon — background/gradient, icon (text) color, and any extra
 * ring/shadow treatment matching that material's real-world look.
 */
export const MATERIAL_STYLES: Record<string, string> = {
  가죽: "bg-gradient-to-br from-amber-700 to-amber-900 text-amber-50",
  미니멀: "bg-stone-100 text-stone-500 ring-1 ring-stone-200",
  빈티지: "bg-gradient-to-br from-orange-200 to-rose-300 text-rose-800",
  우드: "bg-gradient-to-br from-yellow-800 to-yellow-950 text-yellow-50",
  메탈: "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-800",
  실리콘: "bg-gradient-to-br from-sky-200 to-sky-300 text-sky-700",
  레트로: "bg-gradient-to-br from-fuchsia-300 to-amber-200 text-fuchsia-800",
  홀로그램: "bg-[conic-gradient(from_90deg,#fbc2eb,#a6c1ee,#fbc2eb)] text-violet-700",
  파스텔: "bg-gradient-to-br from-primary-100 to-mint-100 text-primary-600",
  캔버스: "bg-stone-200 text-stone-600",
  니트: "bg-gradient-to-br from-rose-100 to-rose-200 text-rose-700",
  투명: "bg-white/60 text-stone-500 ring-1 ring-stone-200 backdrop-blur",
  각인: "bg-gradient-to-br from-zinc-300 to-zinc-400 text-zinc-800",
  야광: "bg-mint-900 text-mint-300 shadow-[0_0_16px_2px_rgba(74,222,128,0.5)]",
  미니: "bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700",
};

export const DEFAULT_MATERIAL_STYLE = "bg-stone-100 text-stone-400 ring-1 ring-stone-200";
```

Note: `bg-mint-900` and `mint-900` are not in the `mint` scale defined in Task 1 (which stops at `800`). Add one more shade to `apps/frontend/tailwind.config.ts`'s `mint` color object from Task 1:

```ts
          900: "#123B2B",
```

(Insert it as the last key in the `mint` object, after `800`.)

- [ ] **Step 3: Create `apps/frontend/src/components/ProductIcon.tsx`**

```tsx
import { PRODUCT_ICONS } from "./icons/productIcons";
import { DEFAULT_MATERIAL_STYLE, MATERIAL_STYLES } from "./icons/productStyles";

interface ProductIconProps {
  tags: string[];
  name: string;
  className?: string;
}

export function ProductIcon({ tags, name, className = "" }: ProductIconProps): JSX.Element {
  const subjectTag = tags.find((tag) => tag in PRODUCT_ICONS);
  const materialTag = tags.find((tag) => tag in MATERIAL_STYLES);
  const Icon = PRODUCT_ICONS[subjectTag ?? "기본"];
  const styleClass = materialTag ? MATERIAL_STYLES[materialTag] : DEFAULT_MATERIAL_STYLE;

  return (
    <div
      className={`flex items-center justify-center rounded-2xl ${styleClass} ${className}`}
      role="img"
      aria-label={name}
    >
      <Icon className="h-1/2 w-1/2" />
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @ringdog/frontend run typecheck && pnpm --filter @ringdog/frontend run lint`
Expected: both pass with no errors. (`ProductIcon` isn't used by any page yet, so there's nothing to visually check until Task 5.)

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/icons apps/frontend/src/components/ProductIcon.tsx apps/frontend/tailwind.config.ts
git commit -m "feat(frontend): add tag-matched SVG product icon system"
```

---

### Task 5: Restyle the home page (catalog + product card)

**Files:**
- Modify: `apps/frontend/src/components/ProductCard.tsx`
- Modify: `apps/frontend/src/components/ProductCatalog.tsx`
- Modify: `apps/frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: `ProductIcon` from Task 4; `font-heading`, `primary-*`, `mint-*`, `shadow-soft`/`shadow-soft-lg` from Tasks 1–2.

- [ ] **Step 1: Replace `apps/frontend/src/components/ProductCard.tsx`**

```tsx
import Link from "next/link";
import { Product } from "@ringdog/shared";

import { ProductIcon } from "@/components/ProductIcon";

export type ProductCardProps = Pick<Product, "id" | "name" | "price" | "imageUrl" | "tags"> & {
  onAddToCart?: () => void;
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);
}

export function ProductCard({ id, name, price, imageUrl, tags, onAddToCart }: ProductCardProps): JSX.Element {
  return (
    <div className="flex flex-col rounded-2xl bg-white p-3 shadow-soft transition hover:-translate-y-1 hover:shadow-soft-lg">
      <Link href={`/products/${id}`} className="text-inherit no-underline">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="aspect-square w-full rounded-xl object-cover" />
        ) : (
          <ProductIcon tags={tags} name={name} className="aspect-square w-full" />
        )}
        <div className="mt-2 truncate font-medium text-stone-800">{name}</div>
        <div className="text-stone-500">{formatPrice(price)}</div>
      </Link>
      {onAddToCart && (
        <button
          type="button"
          className="mt-2 w-full rounded-full bg-primary-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-600"
          onClick={onAddToCart}
        >
          장바구니
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `apps/frontend/src/components/ProductCatalog.tsx`**

```tsx
"use client";

import { Product } from "@ringdog/shared";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/apiClient";
import { isLoggedIn } from "@/lib/auth";

import { ProductCard } from "./ProductCard";

interface ProductsResponse {
  items: Product[];
  page: number;
  limit: number;
  total: number;
}

export function ProductCatalog(): JSX.Element {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const path = q
        ? `/api/products/search?q=${encodeURIComponent(q)}&limit=24`
        : "/api/products?limit=24";
      const data = await apiFetch<ProductsResponse>(path);
      setProducts(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "상품을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  async function handleAddToCart(productId: string): Promise<void> {
    if (!isLoggedIn()) {
      setCartMessage("장바구니에 담으려면 로그인이 필요합니다.");
      return;
    }

    try {
      await apiFetch("/api/cart/items", {
        method: "POST",
        auth: true,
        body: { product_id: productId, quantity: 1 },
      });
      setCartMessage("장바구니에 담았습니다.");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "장바구니 추가에 실패했습니다.";
      setCartMessage(message);
    }
  }

  return (
    <section>
      <h1 className="font-heading text-2xl text-stone-800">{q ? `"${q}" 검색 결과` : "키링 상품"}</h1>
      <p className="mt-1 text-stone-500">{total}개 상품</p>

      {cartMessage && (
        <p className="mt-4 rounded-xl bg-mint-50 px-4 py-3 text-mint-700">{cartMessage}</p>
      )}
      {loading && <p className="mt-4 text-stone-500">불러오는 중...</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              price={Number(product.price)}
              imageUrl={product.imageUrl}
              tags={product.tags}
              onAddToCart={() => handleAddToCart(product.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Update `apps/frontend/src/app/page.tsx`**

```tsx
import { Suspense } from "react";

import { Header } from "@/components/Header";
import { ProductCatalog } from "@/components/ProductCatalog";

export default function HomePage(): JSX.Element {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Suspense fallback={<p className="text-stone-500">불러오는 중...</p>}>
          <ProductCatalog />
        </Suspense>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @ringdog/frontend run typecheck && pnpm --filter @ringdog/frontend run lint`
Expected: both pass with no errors.

Run: `pnpm --filter @ringdog/frontend run dev`, visit `http://localhost:3000` (needs the backend API running to actually list products — if it's not running, at minimum confirm the empty/error state renders with the new styling, no layout break). If the backend is reachable, confirm: product cards are white, rounded, drop-shadowed, lift slightly on hover, and each card shows a colorful SVG icon (not a gray box) matching its product name (e.g. a product with "고양이" in its name/tags shows a cat icon). Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/ProductCard.tsx apps/frontend/src/components/ProductCatalog.tsx apps/frontend/src/app/page.tsx
git commit -m "feat(frontend): restyle home page catalog with Tailwind and product icons"
```

---

### Task 6: Restyle the product detail page

**Files:**
- Modify: `apps/frontend/src/app/products/[id]/page.tsx`

**Interfaces:**
- Consumes: `ProductIcon` from Task 4.

- [ ] **Step 1: Replace `apps/frontend/src/app/products/[id]/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Product } from "@ringdog/shared";

import { Header } from "@/components/Header";
import { ProductIcon } from "@/components/ProductIcon";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { isLoggedIn } from "@/lib/auth";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);
}

export default function ProductDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Product>(`/api/products/${params.id}`);
      setProduct(data);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "상품을 찾을 수 없습니다." : "상품을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  async function handleAddToCart(): Promise<void> {
    if (!isLoggedIn()) {
      setCartMessage("장바구니에 담으려면 로그인이 필요합니다.");
      return;
    }
    if (!product) {
      return;
    }

    try {
      await apiFetch("/api/cart/items", {
        method: "POST",
        auth: true,
        body: { product_id: product.id, quantity: 1 },
      });
      setCartMessage("장바구니에 담았습니다.");
    } catch (err) {
      setCartMessage(err instanceof ApiError ? err.message : "장바구니 추가에 실패했습니다.");
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <p>
          <Link href="/" className="text-sm text-stone-500 hover:text-primary-600">
            ← 목록으로
          </Link>
        </p>

        {loading && <p className="mt-4 text-stone-500">불러오는 중...</p>}
        {error && <p className="mt-4 text-red-600">{error}</p>}

        {!loading && product && (
          <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-[minmax(0,280px)_1fr]">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="aspect-square w-full rounded-2xl object-cover" />
            ) : (
              <ProductIcon tags={product.tags} name={product.name} className="aspect-square w-full" />
            )}

            <div>
              <h1 className="font-heading text-2xl text-stone-800">{product.name}</h1>
              <p className="mt-2 text-xl font-bold text-primary-600">{formatPrice(product.price)}</p>

              {product.tags.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2 text-sm text-stone-500">
                  {product.tags.map((tag) => (
                    <li key={tag} className="rounded-full bg-stone-100 px-3 py-1">
                      #{tag}
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-4 leading-relaxed text-stone-600">{product.description}</p>
              <p className="mt-2 text-sm text-stone-400">재고 {product.stock}개</p>

              {cartMessage && (
                <p className="mt-4 rounded-xl bg-mint-50 px-4 py-3 text-mint-700">{cartMessage}</p>
              )}

              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={handleAddToCart}
                className="mt-4 rounded-full bg-primary-500 px-5 py-2.5 font-medium text-white transition hover:bg-primary-600 disabled:opacity-50"
              >
                {product.stock > 0 ? "장바구니에 담기" : "품절"}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @ringdog/frontend run typecheck && pnpm --filter @ringdog/frontend run lint`
Expected: both pass with no errors.

Run: `pnpm --filter @ringdog/frontend run dev`, visit `http://localhost:3000/products/<some-id>` (with the backend running). Confirm: a large colorful product icon on the left, product name in Jua, coral price, rounded tag pills, and a coral "장바구니에 담기" button. Stop the dev server after confirming.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/src/app/products/[id]/page.tsx"
git commit -m "feat(frontend): restyle product detail page with Tailwind and product icon"
```

---

### Task 7: Restyle the cart page

**Files:**
- Modify: `apps/frontend/src/app/cart/page.tsx`

- [ ] **Step 1: Replace `apps/frontend/src/app/cart/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Header } from "@/components/Header";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { isLoggedIn } from "@/lib/auth";

interface CartProduct {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: CartProduct;
}

interface CartResponse {
  items: CartItem[];
}

interface CheckoutResponse {
  order_id: string;
  status: string;
  total_amount: number;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);
}

export default function CartPage(): JSX.Element {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState("RINGDOG100");
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<CheckoutResponse | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    void (async () => {
      try {
        const data = await apiFetch<CartResponse>("/api/cart", { auth: true });
        setItems(data.items);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "장바구니를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0,
  );

  async function handleRemove(itemId: string): Promise<void> {
    try {
      await apiFetch(`/api/cart/items/${itemId}`, { method: "DELETE", auth: true });
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "삭제에 실패했습니다.");
    }
  }

  async function handleCheckout(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setCheckingOut(true);
    setError(null);

    try {
      const result = await apiFetch<CheckoutResponse>("/api/orders/checkout", {
        method: "POST",
        auth: true,
        body: { coupon_code: couponCode || undefined },
      });
      setOrderResult(result);
      setItems([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "결제에 실패했습니다.");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-md px-6 py-8">
        <h1 className="font-heading text-2xl text-stone-800">장바구니</h1>

        {loading && <p className="mt-4 text-stone-500">불러오는 중...</p>}
        {error && <p className="mt-4 text-red-600">{error}</p>}

        {orderResult && (
          <div className="mt-4 rounded-xl bg-mint-50 px-4 py-3 text-mint-700">
            <p>주문이 완료되었습니다. (주문번호: {orderResult.order_id})</p>
            <p>결제 금액: {formatPrice(orderResult.total_amount)}</p>
            <Link href="/" className="font-medium underline">
              쇼핑 계속하기
            </Link>
          </div>
        )}

        {!loading && !orderResult && items.length === 0 && (
          <p className="mt-4 text-stone-600">
            장바구니가 비어 있습니다.{" "}
            <Link href="/" className="font-medium text-primary-600 underline">
              상품 보러가기
            </Link>
          </p>
        )}

        {!loading && items.length > 0 && (
          <>
            <ul className="mt-4 flex flex-col divide-y divide-stone-200">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-3">
                  <span className="text-stone-700">
                    {item.product.name} × {item.quantity}
                  </span>
                  <span className="text-stone-700">{formatPrice(Number(item.product.price) * item.quantity)}</span>
                  <button
                    type="button"
                    className="text-sm text-stone-400 underline hover:text-red-600"
                    onClick={() => handleRemove(item.id)}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-lg font-bold text-stone-800">합계: {formatPrice(subtotal)}</p>

            <form className="mt-6 flex flex-col gap-4" onSubmit={handleCheckout}>
              <label className="flex flex-col gap-1 text-sm text-stone-600">
                데모 쿠폰 (RINGDOG100 입력 시 0원)
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="RINGDOG100"
                  className="rounded-xl border border-stone-200 px-3 py-2 text-base text-stone-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </label>
              <button
                type="submit"
                className="rounded-full bg-primary-500 px-4 py-2.5 font-medium text-white transition hover:bg-primary-600 disabled:opacity-50"
                disabled={checkingOut}
              >
                {checkingOut ? "결제 처리 중..." : "결제하기"}
              </button>
            </form>
          </>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @ringdog/frontend run typecheck && pnpm --filter @ringdog/frontend run lint`
Expected: both pass with no errors.

Run: `pnpm --filter @ringdog/frontend run dev`, visit `http://localhost:3000/cart` while logged in. Confirm: rounded coupon input, coral checkout button, mint success banner on checkout. Stop the dev server after confirming.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/cart/page.tsx
git commit -m "feat(frontend): restyle cart page with Tailwind"
```

---

### Task 8: Restyle the login and signup pages

**Files:**
- Modify: `apps/frontend/src/app/login/page.tsx`
- Modify: `apps/frontend/src/app/signup/page.tsx`

- [ ] **Step 1: Replace `apps/frontend/src/app/login/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Header } from "@/components/Header";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { setToken } from "@/lib/auth";

interface LoginResponse {
  token: string;
  expires_in: string;
}

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setToken(data.token);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-sm px-6 py-8">
        <h1 className="font-heading text-2xl text-stone-800">로그인</h1>
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm text-stone-600">
            이메일
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-xl border border-stone-200 px-3 py-2 text-base text-stone-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-stone-600">
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              className="rounded-xl border border-stone-200 px-3 py-2 text-base text-stone-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </label>
          {error && <p className="text-red-600">{error}</p>}
          <button
            type="submit"
            className="rounded-full bg-primary-500 px-4 py-2.5 font-medium text-white transition hover:bg-primary-600 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "처리 중..." : "로그인"}
          </button>
        </form>
        <p className="mt-4 text-sm text-stone-600">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="font-medium text-primary-600 underline">
            회원가입
          </Link>
        </p>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Replace `apps/frontend/src/app/signup/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Header } from "@/components/Header";
import { apiFetch, ApiError } from "@/lib/apiClient";

export default function SignupPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiFetch("/api/auth/signup", {
        method: "POST",
        body: { email, password },
      });
      router.push("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-sm px-6 py-8">
        <h1 className="font-heading text-2xl text-stone-800">회원가입</h1>
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm text-stone-600">
            이메일
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-xl border border-stone-200 px-3 py-2 text-base text-stone-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-stone-600">
            비밀번호 (8자 이상)
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              className="rounded-xl border border-stone-200 px-3 py-2 text-base text-stone-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </label>
          {error && <p className="text-red-600">{error}</p>}
          <button
            type="submit"
            className="rounded-full bg-primary-500 px-4 py-2.5 font-medium text-white transition hover:bg-primary-600 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "처리 중..." : "가입하기"}
          </button>
        </form>
        <p className="mt-4 text-sm text-stone-600">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-medium text-primary-600 underline">
            로그인
          </Link>
        </p>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @ringdog/frontend run typecheck && pnpm --filter @ringdog/frontend run lint`
Expected: both pass with no errors.

Run: `pnpm --filter @ringdog/frontend run dev`, visit `http://localhost:3000/login` and `http://localhost:3000/signup`. Confirm: rounded inputs with a coral focus ring, coral submit button. Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/app/login/page.tsx apps/frontend/src/app/signup/page.tsx
git commit -m "feat(frontend): restyle login and signup pages with Tailwind"
```

---

### Task 9: Restyle the orders page

**Files:**
- Modify: `apps/frontend/src/app/orders/page.tsx`

- [ ] **Step 1: Replace `apps/frontend/src/app/orders/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Order, OrderStatus } from "@ringdog/shared";

import { Header } from "@/components/Header";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { isLoggedIn } from "@/lib/auth";

interface OrdersResponse {
  items: Order[];
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "결제 대기",
  PAID: "결제 완료",
  SHIPPED: "배송 완료",
  CANCELLED: "취소됨",
};

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-mint-100 text-mint-700",
  SHIPPED: "bg-sky-100 text-sky-700",
  CANCELLED: "bg-stone-200 text-stone-500",
};

const CANCELLABLE_STATUSES: OrderStatus[] = ["PENDING", "PAID"];

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export default function OrdersPage(): JSX.Element {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<OrdersResponse>("/api/orders", { auth: true });
      setOrders(data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "주문 내역을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    void loadOrders();
  }, [router, loadOrders]);

  async function handleCancel(orderId: string): Promise<void> {
    setCancellingId(orderId);
    setError(null);
    try {
      const updated = await apiFetch<Order>(`/api/orders/${orderId}/cancel`, {
        method: "PATCH",
        auth: true,
      });
      setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "주문 취소에 실패했습니다.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="font-heading text-2xl text-stone-800">주문 내역</h1>

        {loading && <p className="mt-4 text-stone-500">불러오는 중...</p>}
        {error && <p className="mt-4 text-red-600">{error}</p>}

        {!loading && orders.length === 0 && !error && (
          <p className="mt-4 text-stone-600">
            아직 주문 내역이 없습니다.{" "}
            <Link href="/" className="font-medium text-primary-600 underline">
              상품 보러가기
            </Link>
          </p>
        )}

        {!loading && orders.length > 0 && (
          <ul className="mt-6 flex flex-col gap-4">
            {orders.map((order) => (
              <li key={order.id} className="rounded-2xl bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-stone-800">주문번호 {order.id.slice(0, 8)}</div>
                    <div className="text-sm text-stone-400">{formatDate(order.createdAt)}</div>
                  </div>
                  <span
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[order.status]}`}
                  >
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>

                <ul className="mt-3 flex flex-col gap-1 text-sm text-stone-600">
                  {order.items?.map((item) => (
                    <li key={item.id}>
                      {item.product?.name ?? "상품"} × {item.quantity}
                      <span className="text-stone-400"> ({formatPrice(item.unitPrice * item.quantity)})</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                  <span className="font-bold text-stone-800">합계: {formatPrice(order.totalAmount)}</span>
                  {CANCELLABLE_STATUSES.includes(order.status) && (
                    <button
                      type="button"
                      disabled={cancellingId === order.id}
                      onClick={() => handleCancel(order.id)}
                      className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-200 disabled:opacity-50"
                    >
                      {cancellingId === order.id ? "취소 중..." : "주문 취소"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @ringdog/frontend run typecheck && pnpm --filter @ringdog/frontend run lint`
Expected: both pass with no errors.

Run: `pnpm --filter @ringdog/frontend run dev`, visit `http://localhost:3000/orders` while logged in with existing orders. Confirm: each order is a white rounded card with a colored status pill (amber/mint/sky/gray matching pending/paid/shipped/cancelled). Stop the dev server after confirming.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/orders/page.tsx
git commit -m "feat(frontend): restyle orders page and status badges with Tailwind"
```

---

### Task 10: Restyle the chat widget

**Files:**
- Modify: `apps/frontend/src/components/ChatWidget.tsx`

- [ ] **Step 1: Replace `apps/frontend/src/components/ChatWidget.tsx`**

```tsx
"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { getToken } from "@/lib/auth";

// Wire format matches PRD `api_contracts.chatbot` (snake_case), which is
// what chatbot-service's Express routes actually accept/return.
interface ChatMessagesResponse {
  reply: string;
  session_id: string;
}

interface ChatBubble {
  role: "user" | "assistant";
  content: string;
}

// See apps/frontend/src/lib/apiClient.ts for why this defaults to a relative
// path rather than a localhost fallback.
const CHATBOT_API_BASE_URL = process.env.NEXT_PUBLIC_CHATBOT_API_BASE_URL ?? "";

/**
 * Floating chatbot widget available on every page (FR-CHAT-001). Renders the
 * running back-and-forth as chat bubbles (user right-aligned, assistant
 * left-aligned) rather than only the latest reply.
 *
 * TODO(M3): streaming replies.
 */
export function ChatWidget(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, isLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const text = message.trim();
    if (!text) {
      return;
    }

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setMessage("");
    setIsLoading(true);
    setError(null);

    try {
      const token = getToken();
      const response = await fetch(`${CHATBOT_API_BASE_URL}/api/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ session_id: sessionId, message: text }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      const data = (await response.json()) as ChatMessagesResponse;
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      setSessionId(data.session_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-[1000] flex flex-col items-end gap-3">
      {isOpen && (
        <div className="flex w-[300px] flex-col overflow-hidden rounded-3xl bg-white shadow-soft-lg">
          <div className="flex items-center justify-between bg-primary-500 px-4 py-3 text-white">
            <span className="font-heading">RingDog Assistant</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div ref={bodyRef} className="flex max-h-[360px] min-h-[120px] flex-col gap-2 overflow-y-auto p-4 text-sm">
            {messages.length === 0 && !isLoading && (
              <p className="text-stone-400">Ask about products or your orders.</p>
            )}
            {messages.map((bubble, index) => (
              <div
                key={index}
                className={
                  bubble.role === "user"
                    ? "max-w-[80%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary-100 px-3 py-2 leading-relaxed text-primary-800"
                    : "max-w-[80%] self-start whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-stone-100 px-3 py-2 leading-relaxed text-stone-700"
                }
              >
                {bubble.content}
              </div>
            ))}
            {isLoading && (
              <div className="max-w-[80%] self-start rounded-2xl rounded-bl-md bg-stone-100 px-3 py-2 text-stone-400">
                ···
              </div>
            )}
            {error && <p className="text-red-600">{error}</p>}
          </div>

          <form className="flex gap-2 border-t border-stone-100 p-3" onSubmit={handleSubmit}>
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
              className="flex-1 rounded-full border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <button
              type="submit"
              disabled={isLoading || !message.trim()}
              className="rounded-full bg-primary-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-600 disabled:opacity-50"
            >
              {isLoading ? "..." : "Send"}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Toggle chat widget"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-2xl text-white shadow-soft-lg transition hover:bg-primary-600"
      >
        💬
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @ringdog/frontend run typecheck && pnpm --filter @ringdog/frontend run lint`
Expected: both pass with no errors.

Run: `pnpm --filter @ringdog/frontend run dev`, visit `http://localhost:3000`, click the floating chat button. Confirm: coral round toggle button, rounded chat panel, coral user bubbles right-aligned, gray assistant bubbles left-aligned. Stop the dev server after confirming.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/ChatWidget.tsx
git commit -m "feat(frontend): restyle chat widget with Tailwind"
```

---

### Task 11: Restyle error pages and finish the globals.css cleanup

**Files:**
- Modify: `apps/frontend/src/app/error.tsx`
- Modify: `apps/frontend/src/app/global-error.tsx`
- Verify: `apps/frontend/src/app/globals.css` (already minimal since Task 1 — confirm no page still references a deleted legacy class)

- [ ] **Step 1: Replace `apps/frontend/src/app/error.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { addNextjsError } from "@datadog/browser-rum-nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    addNextjsError(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="font-heading text-2xl text-stone-800">앗, 문제가 발생했어요</h1>
      <p className="text-stone-500">페이지를 불러오는 중 오류가 발생했습니다.</p>
      <button
        onClick={reset}
        className="rounded-full bg-primary-500 px-4 py-2.5 font-medium text-white transition hover:bg-primary-600"
      >
        Try again
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Replace `apps/frontend/src/app/global-error.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { addNextjsError } from "@datadog/browser-rum-nextjs";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    addNextjsError(error);
  }, [error]);

  // This replaces the entire root layout (including <html>/<body>), so it
  // never gets the font CSS variables layout.tsx sets — Tailwind's
  // fontFamily.sans fallback (defaultTheme.fontFamily.sans) is what actually
  // renders here, not Noto Sans KR. Acceptable for this rare full-app-crash
  // screen.
  return (
    <html lang="ko">
      <body className="flex min-h-screen items-center justify-center bg-cream font-sans text-stone-800">
        <main className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <h1 className="font-heading text-2xl">앗, 문제가 발생했어요</h1>
          <p className="text-stone-500">애플리케이션에 심각한 오류가 발생했습니다.</p>
          <button
            onClick={reset}
            className="rounded-full bg-primary-500 px-4 py-2.5 font-medium text-white transition hover:bg-primary-600"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Confirm no leftover references to deleted legacy CSS classes**

Run: `grep -rn "site-header\|product-card\|chat-widget\|chat-bubble\|order-status\|order-card\|cart-list\|cart-total\|auth-form\|checkout-form\|product-detail\|info-banner\|success-banner\|error-text\|link-button\|button--small\|muted\b" apps/frontend/src`
Expected: no matches (every component was migrated to Tailwind classes in Tasks 3–10). If anything matches, that file was missed in an earlier task — go back and restyle it before continuing.

- [ ] **Step 4: Full-app manual verification pass**

Run: `pnpm --filter @ringdog/frontend run typecheck && pnpm --filter @ringdog/frontend run lint`
Expected: both pass with no errors.

Run: `pnpm --filter @ringdog/frontend run build`
Expected: production build succeeds (this also catches any Tailwind/PostCSS build-time issues that `next dev` might not).

Run: `pnpm --filter @ringdog/frontend run dev` and, with the backend running, click through every in-scope page: home (with and without a search query), a product detail page, cart (empty and with items, plus a checkout), login, signup, orders (with a cancellable and non-cancellable order if possible), the chat widget open/closed, and trigger an error state (e.g. visit a non-existent product ID) to see `error.tsx`. Confirm the coral/mint/cream palette, Jua headings, Noto Sans KR body text, and rounded shapes appear consistently across all of them, and that the SVG product icons render (not gray boxes) with visibly different colors/motifs across a range of products. Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/error.tsx apps/frontend/src/app/global-error.tsx
git commit -m "feat(frontend): restyle error pages with Tailwind, complete cute redesign"
```
