# RingDog CI/CD Visibility (Datadog) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix RingDog's broken Datadog Test Optimization wiring, make it actually exercise real code by adding a genuine unit test suite to `backend-api`, gate `cd.yml`'s deploy on lint+test passing (since this project pushes straight to `main`, never through a PR), and add proper Deployment Visibility (`datadog-ci deployment mark`) alongside the existing manual deployment marker.

**Architecture:** Extract the checkout endpoint's order-total math into a small pure function in `backend-api` and cover it with a real Vitest suite (matching `packages/shared`'s existing test convention). Fix the two missing Datadog env vars/require-hook that silently break Test Optimization on a GitHub-hosted runner, apply the identical fix to a new `cd.yml` job so tests actually run on every push to `main`, and add one new `datadog-ci` step for Deployment Tracking.

**Tech Stack:** GitHub Actions, Vitest, dd-trace (already a dependency across all apps), `@datadog/datadog-ci` CLI (new, pinned exact version).

**Spec:** `docs/design/specs/2026-07-23-ci-cd-visibility-design.md`

## Global Constraints

- No new test framework beyond Vitest — `packages/shared` already uses it (`vitest run`, `describe`/`it`/`expect` imported from `"vitest"`); match that convention exactly.
- `dd-trace` is already a direct dependency of `backend-api`, `chatbot-service`, `order-consumer`, and `packages/shared` (`^5.19.0` in every case) — the `NODE_OPTIONS=-r dd-trace/ci/init` require hook needs no new dependency to resolve.
- Pin `@datadog/datadog-ci` to an exact version (`5.21.0`) — Datadog's own guidance is to avoid an unpinned `@latest` due to breaking-change/supply-chain risk, and this repository is a public GitHub repo (redact/never hardcode secret values; only ever reference `secrets.*`/`vars.*`).
- Do not touch the existing "Send Datadog deployment marker" step (Events API curl, tagged `NFR-OBS-003`) in `cd.yml` — the new Deployment Tracking step is additive, not a replacement.
- Out of scope: tests for any app other than `backend-api`, ASM, changing `ci.yml`'s `pull_request` trigger, adopting a PR workflow, reusable-workflow refactors of `ci.yml`/`cd.yml`.
- This repo has no `NODE_VERSION` top-level env in `cd.yml` today; `ci.yml` uses `"24"` — reuse the same value for consistency.

---

### Task 1: `backend-api` real unit tests (order total calculation) (2026-10-16 main에 cherry-pick됨)

**Files:**
- Create: `apps/backend-api/src/lib/orderTotal.ts`
- Create: `apps/backend-api/src/lib/orderTotal.test.ts`
- Modify: `apps/backend-api/src/routes/orders.ts:6` (import), `apps/backend-api/src/routes/orders.ts:40-45` (use the extracted function)
- Modify: `apps/backend-api/package.json` (add `vitest` devDependency, change `test` script)

**Interfaces:**
- Produces: `calculateOrderTotal(items: OrderTotalItem[], couponCode: string | undefined): OrderTotalResult` where `OrderTotalItem = { price: number; quantity: number }` and `OrderTotalResult = { subtotal: number; totalAmount: number; isDemoCoupon: boolean }`. Consumed by `orders.ts`'s checkout handler (Step 5 below) — no other task depends on this.

- [ ] **Step 1: Write the failing tests**

Create `apps/backend-api/src/lib/orderTotal.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { calculateOrderTotal } from "./orderTotal";

describe("calculateOrderTotal", () => {
  it("sums price * quantity across multiple items for the subtotal", () => {
    const result = calculateOrderTotal(
      [
        { price: 10000, quantity: 2 },
        { price: 5000, quantity: 1 },
      ],
      undefined,
    );
    expect(result.subtotal).toBe(25000);
  });

  it("zeroes the total when the demo coupon code is used", () => {
    const result = calculateOrderTotal([{ price: 10000, quantity: 3 }], "RINGDOG100");
    expect(result.subtotal).toBe(30000);
    expect(result.totalAmount).toBe(0);
    expect(result.isDemoCoupon).toBe(true);
  });

  it("leaves the total equal to the subtotal for a non-demo coupon code", () => {
    const result = calculateOrderTotal([{ price: 10000, quantity: 1 }], "SOMEOTHERCODE");
    expect(result.totalAmount).toBe(10000);
    expect(result.isDemoCoupon).toBe(false);
  });

  it("handles a single-item cart with no coupon", () => {
    const result = calculateOrderTotal([{ price: 4999, quantity: 1 }], undefined);
    expect(result.subtotal).toBe(4999);
    expect(result.totalAmount).toBe(4999);
    expect(result.isDemoCoupon).toBe(false);
  });
});
```

- [ ] **Step 2: Add `vitest` and point the `test` script at it**

In `apps/backend-api/package.json`, add to `devDependencies` (alphabetical position, matching the file's existing ordering):

```json
    "vitest": "^2.0.5",
```

Change the `scripts.test` line from:

```json
    "test": "echo \"no tests yet\""
```

to:

```json
    "test": "vitest run"
```

- [ ] **Step 3: Install and run the test to verify it fails**

Run: `npx --yes pnpm@9.15.0 install` (repo root), then `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api run test`
Expected: FAIL — `orderTotal.ts` doesn't exist yet, so the import in the test file errors (e.g. "Cannot find module './orderTotal'").

- [ ] **Step 4: Write the minimal implementation**

Create `apps/backend-api/src/lib/orderTotal.ts`:

```ts
import { DEMO_COUPON_CODE } from "@ringdog/shared";

export interface OrderTotalItem {
  price: number;
  quantity: number;
}

export interface OrderTotalResult {
  subtotal: number;
  totalAmount: number;
  isDemoCoupon: boolean;
}

export function calculateOrderTotal(
  items: OrderTotalItem[],
  couponCode: string | undefined,
): OrderTotalResult {
  const isDemoCoupon = couponCode === DEMO_COUPON_CODE;
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalAmount = isDemoCoupon ? 0 : subtotal;
  return { subtotal, totalAmount, isDemoCoupon };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api run test`
Expected: PASS — 4/4 tests passing, no other output/warnings.

- [ ] **Step 6: Wire the real route to use the extracted function**

In `apps/backend-api/src/routes/orders.ts`, change the import block (currently lines 1-9) from:

```ts
import { randomUUID } from "crypto";

import { NextFunction, Request, Response, Router } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "@ringdog/db";
import { DEMO_COUPON_CODE, OrderPlacedEvent, OrderStatus, logger } from "@ringdog/shared";

import { requireAuth } from "../middleware/auth";
import { publishOrderPlaced } from "../lib/kafka";
```

to:

```ts
import { randomUUID } from "crypto";

import { NextFunction, Request, Response, Router } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "@ringdog/db";
import { OrderPlacedEvent, OrderStatus, logger } from "@ringdog/shared";

import { requireAuth } from "../middleware/auth";
import { calculateOrderTotal } from "../lib/orderTotal";
import { publishOrderPlaced } from "../lib/kafka";
```

(`DEMO_COUPON_CODE` moved into `orderTotal.ts` and is no longer referenced directly here.)

Then change the checkout handler body (currently):

```ts
      const isDemoCoupon = couponCode === DEMO_COUPON_CODE;
      const subtotal = cartItems.reduce(
        (sum, item) => sum + Number(item.product.price) * item.quantity,
        0,
      );
      const totalAmount = isDemoCoupon ? 0 : subtotal;
```

to:

```ts
      const { totalAmount, isDemoCoupon } = calculateOrderTotal(
        cartItems.map((item) => ({ price: Number(item.product.price), quantity: item.quantity })),
        couponCode,
      );
```

Everything below this (the `prisma.$transaction` block, `order.couponCode: isDemoCoupon ? couponCode : null`, the response body) stays exactly as it is — both variables it reads (`totalAmount`, `isDemoCoupon`) still exist with the same names and types.

- [ ] **Step 7: Verify typecheck, lint, and tests all still pass**

Run: `npx --yes pnpm@9.15.0 --filter @ringdog/backend-api run typecheck && npx --yes pnpm@9.15.0 --filter @ringdog/backend-api run lint && npx --yes pnpm@9.15.0 --filter @ringdog/backend-api run test`
Expected: all three pass — typecheck with no errors, lint with no warnings (confirms `DEMO_COUPON_CODE`'s removal from the import didn't leave an unused-import warning elsewhere and nothing else broke), test 4/4 passing.

- [ ] **Step 8: Commit**

```bash
git add apps/backend-api/src/lib/orderTotal.ts apps/backend-api/src/lib/orderTotal.test.ts apps/backend-api/src/routes/orders.ts apps/backend-api/package.json pnpm-lock.yaml
git commit -m "test(backend-api): add real unit tests for order total calculation"
```

---

### Task 2: Fix Test Optimization instrumentation in `ci.yml`

**Files:**
- Modify: `.github/workflows/ci.yml:37-49` (the `unit_test` job)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing later tasks import — this is a standalone CI config fix. Task 3 applies the identical fix to a different file (`cd.yml`); keep the two in sync by eye, there's no shared code artifact between them.

- [ ] **Step 1: Replace the `unit_test` job's comment and env block**

In `.github/workflows/ci.yml`, the `unit_test` job currently reads (lines 37-49):

```yaml
  unit_test:
    name: Unit Test
    runs-on: ubuntu-latest
    # Datadog CI Visibility (PRD technology_stack.ci_cd.datadog_integration):
    # DD_CIVISIBILITY_ENABLED=true + dd-trace auto-instruments Jest test runs when these
    # env vars are present, since backend-api/chatbot-service already depend on dd-trace.
    # No extra CLI wrapper is required for that auto-instrumentation to kick in.
    env:
      DD_CIVISIBILITY_ENABLED: "true"
      DD_API_KEY: ${{ secrets.DD_API_KEY }}
      DD_ENV: ci
      DD_SERVICE: ringdog-ci
    steps:
```

Replace it with:

```yaml
  unit_test:
    name: Unit Test
    runs-on: ubuntu-latest
    # Datadog Test Optimization (PRD technology_stack.ci_cd.datadog_integration):
    # GitHub-hosted runners have no reachable Datadog Agent, so this needs Agentless
    # mode (DD_CIVISIBILITY_AGENTLESS_ENABLED + DD_SITE) plus the dd-trace require
    # hook (NODE_OPTIONS=-r dd-trace/ci/init) to actually instrument the test run —
    # dd-trace is already a direct dependency of every workspace package that has
    # tests, so the hook resolves correctly per-package with no extra install.
    env:
      DD_CIVISIBILITY_ENABLED: "true"
      DD_CIVISIBILITY_AGENTLESS_ENABLED: "true"
      DD_API_KEY: ${{ secrets.DD_API_KEY }}
      DD_SITE: ${{ vars.DD_SITE || 'datadoghq.com' }}
      DD_ENV: ci
      DD_SERVICE: ringdog-ci
      NODE_OPTIONS: "-r dd-trace/ci/init"
    steps:
```

Leave the rest of the job (the `steps:` block and everything after it) untouched. Also leave the commented-out "Optional / future (M4)" block at the bottom of this job untouched — it describes a different, still-deferred enhancement (explicit JUnit upload for packages that don't depend on `dd-trace`), unrelated to this fix.

- [ ] **Step 2: Validate the YAML is still well-formed**

Run: `node -e "require('js-yaml') ? '' : ''" 2>/dev/null; python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid')"`

If `python3`/`pyyaml` isn't available, instead run: `node -e "const fs=require('fs'); const c=fs.readFileSync('.github/workflows/ci.yml','utf8'); if (!c.includes('NODE_OPTIONS')) throw new Error('missing NODE_OPTIONS'); console.log('looks OK')"` as a minimal sanity check, and visually re-read the file to confirm indentation is consistent with the surrounding YAML (2-space, matching the rest of the file).

Expected: `valid` (or `looks OK`) printed, no YAML parse error.

- [ ] **Step 3: Note on verification scope**

This job only triggers on `pull_request`, and this repository has never had a PR opened (confirmed during design) — adopting a PR workflow is explicitly out of scope for this plan, so this specific job cannot be verified by an actual run here. Task 3 adds the identical env var fix to a new `cd.yml` job that DOES run on every push to `main`; that task's real push-and-verify step is what proves this fix mechanism actually works. Treat this task's completion as "YAML valid + code review confirms it matches Task 3's job exactly," not as independently run-verified.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "fix(ci): add missing agentless-mode env vars and require hook for Test Optimization"
```

---

### Task 3: `cd.yml` — gate deploy on lint+test, add Deployment Tracking

**Files:**
- Modify: `.github/workflows/cd.yml:14-19` (top-level `env:` block)
- Modify: `.github/workflows/cd.yml:25-28` (insert a new job, add `needs:` to `docker_build_push_ecr`)
- Modify: `.github/workflows/cd.yml` around the existing "Update RingDog apps with ALB hostname" / "Send Datadog deployment marker" steps (insert one new step between them)

**Interfaces:**
- Consumes: the same env var fix pattern as Task 2 (not a code dependency — just keep them identical by eye).
- Produces: nothing later tasks import. This is the last task in the plan.

- [ ] **Step 1: Add `NODE_VERSION` to `cd.yml`'s top-level env**

Current top-level env block (lines 14-19):

```yaml
env:
  AWS_REGION: ap-northeast-2
  EKS_CLUSTER_NAME: ringdog-demo
  K8S_NAMESPACE: ringdog
  DD_CIVISIBILITY_ENABLED: "true"
  DD_API_KEY: ${{ secrets.DD_API_KEY }}
```

Replace with:

```yaml
env:
  AWS_REGION: ap-northeast-2
  EKS_CLUSTER_NAME: ringdog-demo
  K8S_NAMESPACE: ringdog
  NODE_VERSION: "24"
  DD_CIVISIBILITY_ENABLED: "true"
  DD_API_KEY: ${{ secrets.DD_API_KEY }}
```

- [ ] **Step 2: Insert the new `lint_and_test` job and gate the Docker build on it**

Current (lines 25-29):

```yaml
jobs:
  docker_build_push_ecr:
    name: Build & Push Docker Images to ECR
    runs-on: ubuntu-latest
    strategy:
```

Replace with:

```yaml
jobs:
  lint_and_test:
    name: Lint & Unit Test
    runs-on: ubuntu-latest
    # Datadog Test Optimization (PRD technology_stack.ci_cd.datadog_integration):
    # this project pushes straight to main (no PR workflow), so ci.yml's
    # pull_request-only unit_test job never runs in practice — this job mirrors
    # its Test Optimization env vars so real test data actually populates.
    # DD_CIVISIBILITY_ENABLED/DD_API_KEY are inherited from the workflow-level
    # env above; only the additional agentless-mode/require-hook vars are added
    # here since they're specific to the test run, not the whole workflow.
    env:
      DD_CIVISIBILITY_AGENTLESS_ENABLED: "true"
      DD_SITE: ${{ vars.DD_SITE || 'datadoghq.com' }}
      DD_ENV: ci
      DD_SERVICE: ringdog-ci
      NODE_OPTIONS: "-r dd-trace/ci/init"
    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v6
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint (pnpm -r run lint)
        run: pnpm lint

      - name: Unit test (pnpm -r run test)
        run: pnpm test

  docker_build_push_ecr:
    name: Build & Push Docker Images to ECR
    needs: lint_and_test
    runs-on: ubuntu-latest
    strategy:
```

- [ ] **Step 3: Add the Deployment Tracking step**

Find the existing "Update RingDog apps with ALB hostname" step (in the `helm_upgrade_eks` job) and the "Send Datadog deployment marker" step right after it:

```yaml
      - name: Update RingDog apps with ALB hostname
        if: ${{ steps.alb.outputs.hostname != '' }}
        env:
          ALB_HOSTNAME: ${{ steps.alb.outputs.hostname }}
        run: |
          helm upgrade --install ringdog deploy/helm/charts/ringdog \
            -n ${{ env.K8S_NAMESPACE }} --reuse-values \
            --set backendApi.env.CORS_ORIGIN="http://${ALB_HOSTNAME}" \
            --set chatbotService.env.CORS_ORIGIN="http://${ALB_HOSTNAME}" \
            --set ingress.host="${ALB_HOSTNAME}"

      # NFR-OBS-003: correlate deploy events with APM error-rate spikes by posting a
      # deployment marker to the Datadog Events API.
      - name: Send Datadog deployment marker
```

Insert a new step between them, so the block reads:

```yaml
      - name: Update RingDog apps with ALB hostname
        if: ${{ steps.alb.outputs.hostname != '' }}
        env:
          ALB_HOSTNAME: ${{ steps.alb.outputs.hostname }}
        run: |
          helm upgrade --install ringdog deploy/helm/charts/ringdog \
            -n ${{ env.K8S_NAMESPACE }} --reuse-values \
            --set backendApi.env.CORS_ORIGIN="http://${ALB_HOSTNAME}" \
            --set chatbotService.env.CORS_ORIGIN="http://${ALB_HOSTNAME}" \
            --set ingress.host="${ALB_HOSTNAME}"

      # Datadog CD Visibility (PRD technology_stack.ci_cd.datadog_integration):
      # datadog-ci's dedicated Deployment Tracking mechanism, distinct from and
      # additive to the generic Events API marker below — this is what feeds
      # the Deployments/DORA views specifically. DD_BETA_COMMANDS_ENABLED=1 is
      # required by Datadog for this still-beta command. Pinned to an exact
      # datadog-ci version per Datadog's own supply-chain guidance.
      - name: Datadog deployment tracking (CD Visibility)
        if: ${{ env.DD_API_KEY != '' }}
        env:
          DD_BETA_COMMANDS_ENABLED: "1"
          DD_SITE: ${{ vars.DD_SITE || 'datadoghq.com' }}
        run: |
          npx --yes @datadog/datadog-ci@5.21.0 deployment mark \
            --env demo \
            --revision ${{ github.sha }} \
            --tags team:platform \
            --tags project:ringdog

      # NFR-OBS-003: correlate deploy events with APM error-rate spikes by posting a
      # deployment marker to the Datadog Events API.
      - name: Send Datadog deployment marker
```

- [ ] **Step 4: Validate the YAML is still well-formed**

Same check as Task 2 Step 2, targeting this file:

Run: `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/cd.yml')); print('valid')"` (or the `node -e` fallback if `python3`/`pyyaml` isn't available), and visually confirm indentation matches the surrounding file (2-space).

Expected: `valid` printed, no YAML parse error.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/cd.yml
git commit -m "feat(cd): gate deploy on lint+test, add datadog-ci deployment tracking"
```

- [ ] **Step 6: Push to `main` and verify the real run**

This repo's git push needs to go through WSL (the SSH key for GitHub is only configured there, not on Windows):

```bash
wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Demo && git push origin main"
```

Then watch the triggered `cd` run:

```bash
wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Demo && ~/.local/bin/gh run list --limit 1"
```

Take the run ID from that output and watch it to completion:

```bash
wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Demo && ~/.local/bin/gh run watch <RUN_ID> --exit-status"
```

Expected, read from the real run (not just its exit code):
- The new `Lint & Unit Test` job runs first and passes (4/4 `orderTotal` tests plus `packages/shared`'s existing suite).
- `Build & Push Docker Images to ECR` only starts after `Lint & Unit Test` succeeds (visible in the run's job graph/timing).
- The `Datadog deployment tracking (CD Visibility)` step in `Deploy to EKS` completes without error (no `::error::` annotation on that step).

Then confirm the data actually landed in Datadog — from wherever you have `plugin:datadog:mcp` access (e.g. this session), run a search for the new Test Optimization spans:

```
search_datadog_spans(query: "service:ringdog-ci", from: "now-15m")
```

Expected: at least one span now returned (previously 0 — see the design spec's investigation). If it's still 0 after the run completes, treat this as BLOCKED and investigate before considering this task done — don't assume success from the workflow's green checkmark alone.
