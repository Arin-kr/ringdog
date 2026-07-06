# @ringdog/frontend

Next.js 14 (App Router) storefront: product browsing/search, auth state,
cart/checkout, and the floating chatbot widget. See `PRD_v1.yaml`
`application_components.frontend`.

## Local dev

```bash
pnpm --filter @ringdog/frontend run dev
```

Next.js reads the `PORT` env var (not `FRONTEND_PORT` directly) — set
`PORT=3000` (matching `FRONTEND_PORT` in `.env.example`) when running
outside `next dev`'s default.

## M2 TODOs

- Real product listing/detail/search pages wired to
  `NEXT_PUBLIC_API_BASE_URL` (`src/app/page.tsx` is currently a static
  placeholder).
- Auth state (signup/login forms, JWT storage, protected cart/checkout
  pages).
- Cart and checkout UI backed by `@ringdog/backend-api`'s `/api/cart` and
  `/api/orders` routes.
- Pass the user's JWT into `ChatWidget` requests once auth state exists, so
  personalized chat queries (FR-CHAT-001) work from the UI.
