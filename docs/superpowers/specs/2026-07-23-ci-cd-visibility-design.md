# RingDog CI/CD Visibility (Datadog)

Date: 2026-07-23

## Context

RingDog's PRD (`PRD_v1.yaml`, `technology_stack.ci_cd.datadog_integration`) calls for Datadog CI/CD Visibility over the GitHub Actions pipeline. The user already enabled the Datadog GitHub App integration ("Repo integration") in the Datadog console.

Investigation before this spec confirmed:

- **Pipeline Visibility + Job Logs Collection already work with zero code changes.** Per Datadog's docs (`docs.datadoghq.com/continuous_integration/pipelines/github/`), enabling the GitHub App integration is the entire setup for workflow/job/step-level Pipeline Visibility — no workflow file changes needed. Confirmed live: `search_datadog_logs` for `source:github` over the last 7 days returned 6,710 real log entries, including today's own `cd`/`ci` workflow runs.
- **Test Visibility is currently broken, not just unused.** `ci.yml`'s `unit_test` job sets `DD_CIVISIBILITY_ENABLED`, `DD_API_KEY`, `DD_ENV`, `DD_SERVICE` and claims (in a comment) that this is enough for dd-trace to auto-instrument Jest. This is incorrect per Datadog's JS/TS test docs (`docs.datadoghq.com/tests/setup/javascript/`): a GitHub-hosted runner has no reachable Datadog Agent, so Test Optimization needs **Agentless mode** (`DD_CIVISIBILITY_AGENTLESS_ENABLED=true`, `DD_SITE`) plus the instrumentation require hook (`NODE_OPTIONS=-r dd-trace/ci/init`) — none of which are currently set. Separately, `ci.yml` only triggers on `pull_request`, and this repository has never had a PR opened (confirmed via `gh pr list --state all`), so the job has literally never executed even in its current broken form.
- **No real tests exist to instrument.** Every app (`backend-api`, `chatbot-service`, `order-consumer`, `frontend`) has `"test": "echo \"no tests yet\""`. Only `packages/shared` has a real Vitest suite.
- **No Deployment Visibility / DORA tracking exists.** `cd.yml` posts a plain Datadog Events API marker (curl, tagged `NFR-OBS-003`) after each deploy — this is a generic event, not Datadog's dedicated Deployment Tracking mechanism (`datadog-ci deployment mark`), which is what feeds the Deployments/DORA views.

## Scope

1. Fix the Test Visibility instrumentation gap in `ci.yml`.
2. Add a lint+test job to `cd.yml` (gating the Docker build jobs) so Test Visibility data actually populates given this project's real workflow — direct pushes to `main`, no PR habit.
3. Add real unit tests to `backend-api` (the service with the most business logic) so there is something genuine for Test Visibility to report on.
4. Add `datadog-ci deployment mark` to `cd.yml` for proper Deployment Visibility/DORA tracking, alongside (not replacing) the existing Events API marker.

Out of scope: adding tests to any other app/package, ASM, changing the existing Events API deployment marker, reusable-workflow refactors of `ci.yml`/`cd.yml`, enabling PRs as a workflow habit.

## Design

### 1. Test Visibility instrumentation fix

Add to `ci.yml`'s `unit_test` job env block (alongside the existing `DD_CIVISIBILITY_ENABLED`/`DD_API_KEY`/`DD_ENV`/`DD_SERVICE`):

```yaml
DD_CIVISIBILITY_AGENTLESS_ENABLED: "true"
DD_SITE: ${{ vars.DD_SITE || 'datadoghq.com' }}
NODE_OPTIONS: "-r dd-trace/ci/init"
```

`dd-trace` is already resolvable from every app's own `node_modules` (`backend-api`, `chatbot-service`, `order-consumer` already depend on it directly at `^5.19.0`; `packages/shared` too), so the require hook resolves correctly per-package without new dependencies. Remove/correct the existing comment's incorrect claim that no extra wiring is needed.

### 2. `cd.yml` lint+test job

New job `lint_and_test`, structurally mirroring `ci.yml`'s `lint`/`unit_test` jobs (checkout, pnpm setup, install, `pnpm lint`, `pnpm test`), with the same Test Visibility env vars as section 1. `docker_build_push_ecr` gets `needs: lint_and_test` added, so a lint/test failure blocks the deploy the same way it would in a PR-gated flow — this is what makes `pipeline_stages: [lint_and_unit_test, build_docker_image, ...]` from the PRD actually hold for this project's real (no-PR) usage pattern.

### 3. `backend-api` real unit tests

`apps/backend-api/src/routes/orders.ts`'s checkout handler currently inlines the order-total calculation (subtotal sum, demo-coupon zero-out) directly in the route body. Extract it into a small pure function, e.g. `apps/backend-api/src/lib/orderTotal.ts`:

```ts
export function calculateOrderTotal(
  cartItems: { product: { price: number | string }; quantity: number }[],
  couponCode: string | undefined,
): { subtotal: number; totalAmount: number }
```

`orders.ts` calls this instead of computing inline. Add a Vitest suite (`apps/backend-api/src/lib/orderTotal.test.ts`) covering: multi-item subtotal sum, demo coupon code zeroing the total, a non-demo coupon code leaving the subtotal unchanged, and a single-item cart. Add `vitest` as a devDependency and change `backend-api`'s `test` script from the stub to `vitest run`, matching `packages/shared`'s existing convention (no new test framework introduced).

### 4. Deployment Visibility (`datadog-ci deployment mark`)

New step in `cd.yml`'s `helm_upgrade_eks` job, after "Update RingDog apps with ALB hostname" and alongside (not replacing) "Send Datadog deployment marker":

```yaml
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
```

`datadog-ci` is pinned to an exact version (`5.21.0`) per Datadog's own guidance (avoid breaking changes/supply-chain risk on an unpinned `@latest`). This version is well past the `4.1.1` threshold where GitHub Actions job-name auto-detection needs no extra `DD_GITHUB_JOB_NAME` workaround, so none is added. This is Datadog's beta Deployment Tracking feature (`DD_BETA_COMMANDS_ENABLED=1` is required by Datadog for it), separate from and additive to the existing Events API curl marker, which stays untouched.

## Verification

- `ci.yml`/`cd.yml` changes: since there's no way to trigger a real PR-based `ci.yml` run without adopting a PR habit (explicitly out of scope), verification for the `ci.yml` fix is by code review + the `cd.yml` job (which runs the identical env/config) actually producing real Test Visibility spans after a push to `main`.
- `cd.yml` lint+test job and deployment-mark step: verified by an actual push to `main` and confirming (a) the new `lint_and_test` job runs and passes, (b) `docker_build_push_ecr` only starts after it, (c) Test Visibility spans for `service:ringdog-ci` appear in Datadog after the run, (d) the Deployments/CD Visibility view shows a new deployment entry for the pushed commit.
- `backend-api` unit tests: standard TDD — write the failing test, implement `calculateOrderTotal`, confirm passing, confirm `orders.ts`'s behavior is unchanged (checkout route still returns the same `total_amount` for both demo-coupon and non-coupon cases).
