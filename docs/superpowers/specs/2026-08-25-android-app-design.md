# RingDog Android App — Design Spec

## Purpose

Add a native Android client for the RingDog shopping app, so Datadog's
infra/APM/log/RUM integrated monitoring can be demonstrated end-to-end
from a real mobile client through to the existing backend and
infrastructure — not just from the Next.js web frontend.

## Scope decision: reuse vs. rebuild

RingDog's `backend-api` is already a framework-agnostic REST API
(`auth`/`products`/`cart`/`orders` routes, JWT bearer auth) with no
dependency on the Next.js frontend. This means:

**Reused as-is:**
- `apps/backend-api` + `packages/db` (Prisma) — no backend changes needed
- Monorepo/infra structure — Terraform/EKS/Helm continue to serve the
  backend only; the Android app is a separate build artifact (APK),
  distributed independently of this infra
- Datadog instrumentation *philosophy* established on the backend
  (structured logs, trace/span correlation, Agent-based routing) —
  carried forward conceptually, though the mobile SDK is a different
  library with a different transport model (see below)

**Built new:**
- The entire client: Kotlin + Jetpack Compose, single module
- Datadog mobile instrumentation: `dd-sdk-android` (RUM, Trace, Logs)
  — a different SDK from `@datadog/browser-rum` (web) or `dd-trace`
  (backend), with mobile-specific concerns (view/session lifecycle,
  ANR detection, agentless transport)
- The mobile→backend distributed tracing link (OkHttp interceptor →
  backend dd-trace continuation)

## v1 feature scope

Core shopping flow only, matching what `backend-api` already exposes:
- Signup / Login (JWT)
- Product list → Product detail
- Cart
- Order placement → Order history / detail

`chatbot-service` (Bedrock LLM chat) is explicitly out of scope for
v1.

## Architecture

- **Location:** `apps/android-app` in the existing pnpm-workspace
  monorepo (Gradle is a separate, independent build system — no
  integration with the pnpm workspace needed)
- **UI:** Jetpack Compose + Navigation Compose
- **Pattern:** MVVM, single module, layered by package —
  `ui/` (Composables + ViewModels), `data/` (Repositories + API
  interfaces), `domain/` (models)
- **Networking:** Retrofit + OkHttp against `backend-api`'s existing
  REST endpoints
- **Auth storage:** JWT stored in `EncryptedSharedPreferences`
  (Android Keystore-backed); OkHttp interceptor attaches
  `Authorization: Bearer <token>` automatically

### Environment switching: local vs. demo

Two Gradle product flavors, `local` and `demo`, per the "fixed at
build time" decision (over an in-app runtime settings screen — kept
simple, no risk of accidentally hitting the wrong server during a
demo).

- `local`: `BASE_URL` fixed to `http://10.0.2.2:<port>` (emulator's
  alias for the host machine's localhost)
- `demo`: `BASE_URL` **must not** be hardcoded in `build.gradle`. This
  repo's EKS ALB hostname changes on every `terraform apply` (the AWS
  Load Balancer Controller provisions a fresh ALB each time, and this
  project tears infra down after most sessions to control cost — see
  project memory). A hardcoded demo URL would go stale every session.
  Instead, inject it at build time as a Gradle property, resolved the
  same way `cd.yml` already resolves the ALB hostname for the web
  frontend:
  ```
  ./gradlew assembleDemoRelease -PDEMO_BASE_URL=$(kubectl get ingress ringdog -n ringdog -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
  ```
  This is a manual one-time build step run right before a customer
  demo, not a CI-automated flow (no scheduled Android CI exists or is
  planned in this scope).

## Components

- `RingDogApplication` — initializes the Datadog SDK (RUM + Trace +
  Logs together) in `onCreate()`
- `NetworkModule` — builds the Retrofit/OkHttp client; interceptor
  chain: auth header → `DatadogInterceptor` (distributed tracing +
  RUM resource tracking) → logging interceptor (debug builds only)
- One Repository + one ViewModel per domain area: Auth, Product, Cart,
  Order
- Screens (Compose Navigation): `LoginScreen`, `SignupScreen`,
  `ProductListScreen`, `ProductDetailScreen`, `CartScreen`,
  `OrderHistoryScreen`, `OrderDetailScreen`

### Datadog credentials

A new Android-type RUM application must be created in Datadog (RUM →
Manage Applications), separate from the existing web RUM application.
Unlike the web frontend's build-time-baking problem (values needed at
*request* time, not bundle time), mobile SDK values are normally baked
into the binary at build time — this is standard for mobile and not a
bug.

- Local dev: values in `local.properties` (already gitignored, the
  standard Android convention) → exposed via `buildConfigField`
- Demo builds: `DD_RUM_APPLICATION_ID_ANDROID` /
  `DD_RUM_CLIENT_TOKEN_ANDROID` added as GitHub Secrets, passed as
  `-P` Gradle properties in the same manual pre-demo build step as
  `DEMO_BASE_URL` above (no Android CI pipeline exists or is planned
  in this scope); documented in `docs/credentials-setup.md` alongside
  the existing web RUM secrets

**Key difference from the backend:** mobile has no Datadog Agent to
route through — `dd-sdk-android` sends RUM/Trace/Logs data directly to
Datadog's intake using the client token (agentless). This is the only
transport option for a mobile device, unlike the backend's
Agent-based routing.

## Data flow

1. App launch → Datadog SDK initializes → RUM session starts
   automatically
2. Screen navigation → `NavigationViewTrackingStrategy` auto-records
   RUM Views (no manual instrumentation per screen)
3. User actions → RUM auto-detects taps on Compose UI; key actions
   ("add to cart", "place order") additionally tagged explicitly via
   `GlobalRumMonitor.get().addAction(...)` for clearer signal
4. Network calls (Retrofit) → `DatadogInterceptor` injects distributed
   trace headers and records the call as a RUM Resource → the
   corresponding backend-api dd-trace span continues the **same
   trace**, giving an end-to-end trace from mobile action through to
   backend spans in APM — this is the core observability goal of this
   app
5. Logs → `dd-sdk-android-logs` sends structured logs for key events
   (login success/failure, order failure, etc.); RUM context (current
   view, session id) is attached automatically

## Error handling

- Repository layer maps network responses to a sealed
  `ApiResult<T>` (`Success` / `Error` / `Loading`); ViewModels expose
  this as UI state; screens show retry affordances / snackbars
- A 401 response triggers an OkHttp `Authenticator` that clears the
  stored token and navigates back to the login screen
- Uncaught exceptions and ANRs are captured automatically as RUM
  errors/crashes by `dd-sdk-android` — no manual instrumentation
  needed

## Testing scope

ViewModel unit tests only (JUnit + MockK + Turbine for Flow), covering
core logic: login success/failure, add-to-cart, order placement.
Compose UI tests and instrumentation-level RUM event verification are
explicitly out of scope — matches this project's general approach of
pragmatic, non-exhaustive test coverage sized to a demo app (see
`backend-api`'s first real test suite, added 2026-07-23, itself
minimal).

## Distribution & testing (no Play Store required)

Play Store registration is not needed for development or customer
demos:
- **Windows dev machine:** Android Studio's built-in emulator (AVD) —
  run directly from the IDE, or `adb install` an APK
- **Physical phone:** enable Developer Options + USB debugging, then
  run from Android Studio over USB/Wi-Fi, or sideload an APK directly
  with `adb install app-demo.apk`

Datadog data collection is unaffected by install method —
`dd-sdk-android` sends data directly to Datadog's intake over standard
HTTP (no Google Play Services dependency), so RUM/APM/Logs work
identically whether the app is running on an emulator or a sideloaded
physical device. Play Store is only relevant for public end-user
distribution, which is out of scope here.
