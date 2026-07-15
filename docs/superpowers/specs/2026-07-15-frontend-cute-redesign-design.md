# RingDog Frontend Cute Redesign

Date: 2026-07-15

## Context

RingDog's frontend (`apps/frontend`, Next.js 15) is a keyring/keychain e-commerce demo built for Datadog observability demos (RUM, APM, etc.). Its current visual design is a bare-bones placeholder: plain CSS in `globals.css`, a solid black header, no brand identity, no logo/favicon. The user wants it to look genuinely nice, matching the "cute keyring shop" concept, using the `frontend-design` skill during implementation.

## Scope

Full app: Header, home/product catalog, product detail, cart, login/signup, orders, chat widget, error pages.

## Approach

Introduce Tailwind CSS and a custom "cute" theme (colors, radius, shadows, fonts) directly — no additional component library (e.g. shadcn/ui). This keeps the change proportionate to a demo app's size while giving full control over the playful aesthetic the user asked for.

## Visual identity

- **Color palette:** coral/peach primary (buttons, logo, key accents), mint or lavender secondary (badges, secondary accents), warm gray neutrals (replacing pure black/white), warm off-white/cream background.
- **Typography:** `next/font/google` loading two fonts —
  - **Jua** for the logo and large headings (rounded, playful, Korean-supporting).
  - **Noto Sans KR** for body text, prices, buttons, forms (readability, weight range).
- **Shape language:** generous border-radius (rounded-2xl scale) on cards, buttons, inputs, chat bubbles — no sharp rectangles. Soft, brand-tinted box-shadows instead of plain black shadows. Product cards get a subtle hover lift/scale.
- **Logo:** a small inline SVG icon (keyring + heart or paw motif) built for this project — no external image asset pipeline needed. Reused for the header logo and as the site favicon/app icon.

## Technical scope

**In scope:**
- Add Tailwind CSS to `apps/frontend` (`tailwind.config.ts`, PostCSS config, Tailwind directives in `globals.css`).
- Load Jua + Noto Sans KR via `next/font/google`, wire into Tailwind's `fontFamily` theme.
- Extend Tailwind theme with the custom color palette, radius scale, and soft shadow tokens described above.
- Restyle every existing page/component using Tailwind utility classes: `Header`, `ProductCatalog`/`ProductCard`, product detail page, cart page, login/signup pages, orders page (including status badge recoloring), `ChatWidget`, `error.tsx`/`global-error.tsx`.
- Build the inline SVG logo component; wire it into the header and as favicon/app icon.
- Remove the old hand-written CSS in `globals.css` once its rules are migrated to Tailwind classes (keep only true global resets/base styles and `@font-face`/theme setup there).

**Out of scope:**
- Dark mode.
- Any additional UI component library.
- Any functional/logic/API changes — this is a styling-only change.
- Product image assets themselves (driven by `imageUrl` data, unchanged).

## Verification

No logic changes, so risk is limited to visual regressions. Verify by running `next dev` locally and viewing every in-scope page in a browser (home/search, product detail, cart, login, signup, orders, chat widget open/closed, an error state), plus confirming `typecheck`/`lint` still pass.
