# RingDog Android

Native Android client for the RingDog shopping app, instrumented with
Datadog RUM, Trace, and Logs. See
`docs/superpowers/specs/2026-08-25-android-app-design.md` for the full
design and `docs/superpowers/plans/2026-08-25-android-app.md` for how it
was built.

## Local development

1. Copy `local.properties.example` to `local.properties` and fill in a
   Datadog Android RUM application's `DD_RUM_APPLICATION_ID` /
   `DD_RUM_CLIENT_TOKEN` (see `docs/credentials-setup.md`).
2. Start `backend-api` locally (see the repo root's local dev setup).
3. Run the `local` flavor from Android Studio, or:
   ```bash
   ./gradlew :app:installLocalDebug
   ```
   The `local` flavor points at `http://10.0.2.2:<port>/`, which is the
   Android emulator's alias for the host machine's `localhost`. No Play
   Store registration is needed — install directly via Android Studio,
   `adb install`, or a sideloaded APK on a real device with USB
   debugging enabled.

## Demo builds

The `demo` flavor's backend URL is **not** hardcoded, because this
repo's EKS ALB hostname changes every `terraform apply`. Build it right
before a demo:

```bash
./gradlew :app:assembleDemoRelease \
  -PDEMO_BASE_URL=$(kubectl get ingress ringdog -n ringdog -o jsonpath='{.status.loadBalancer.ingress[0].hostname}') \
  -PDD_RUM_APPLICATION_ID_ANDROID=<...> \
  -PDD_RUM_CLIENT_TOKEN_ANDROID=<...>
```

## Tests

```bash
./gradlew :app:testLocalDebugUnitTest
```

Covers repositories, interceptors, and ViewModels. Compose screens and
RUM event delivery are verified by running the app and checking the
Datadog UI — see Task 9's manual verification steps in the
implementation plan.
