# RingDog Android

Native Android client for the RingDog shopping app, instrumented with
Datadog RUM, Trace, Logs, and Session Replay (Datadog Android SDK
3.15.0; Compose replay needs the `session-replay-compose` extension,
available from SDK 2.16.0). The original design spec and build plan
were removed from `docs/` on 2026-10-13 and remain in git history.

## Local development

1. Copy `local.properties.example` to `local.properties` and fill in a
   Datadog Android RUM application's `DD_RUM_APPLICATION_ID` /
   `DD_RUM_CLIENT_TOKEN` (see `docs/credentials-setup.md`). The names
   from Datadog's onboarding snippet also work, quoted or not:
   `rum.applicationId`, `rum.clientToken`, `rum.environmentName`
   (overrides `env`), `rum.remoteConfigId`. Unfilled `<PLACEHOLDER>`
   values are ignored; `variant` is always the build flavor.
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

### Behind a TLS-inspecting proxy (e.g. corporate Zscaler)

Symptom: the app works but no RUM sessions reach Datadog. The SDK keeps
collecting (batches pile up under the app's `cache/datadog-*/rum-v2/`),
but uploads fail certificate validation because the proxy re-signs
Datadog's intake certificate with a CA the emulator doesn't trust.

The `local` flavor's debug build trusts user-installed CAs
(`src/local/res/xml/network_security_config.xml`), so install the
proxy's root CA on the emulator once (google_apis image, `adb root`
allowed). No CA file is committed to this public repo:

```bash
# 1. Export the proxy root CA as PEM (Windows: Cert:\LocalMachine\Root, e.g. "Zscaler Root CA")
# 2. Android names CA files by the OpenSSL old-style subject hash
HASH=$(openssl x509 -inform PEM -subject_hash_old -noout -in proxy-root.pem)
cp proxy-root.pem "$HASH.0"
# 3. Install as a user CA
adb root
adb push "$HASH.0" /data/local/tmp/
adb shell "mkdir -p /data/misc/user/0/cacerts-added && cp /data/local/tmp/$HASH.0 /data/misc/user/0/cacerts-added/ && chown system:system /data/misc/user/0/cacerts-added/$HASH.0 && chmod 644 /data/misc/user/0/cacerts-added/$HASH.0"
adb unroot
```

Relaunch the app; the queued batches upload within a minute.

### Emulator tips (Windows)

- Quote SDK package paths for `sdkmanager`/`avdmanager` from PowerShell,
  e.g. `'"system-images;android-34;google_apis;x86_64"'` — unquoted,
  `cmd` splits them at `;` ("Package android-34 not found").
- 2GB AVD RAM made `system` ANR repeatedly on first boot; 3GB
  (`hw.ramSize=3072`) plus `swiftshader_indirect` GPU was stable.
  `-gpu host` crashed on Intel Iris Xe.
- Set `ANDROID_SDK_ROOT` before launching the emulator, or it warns it
  can't find `adb` (harmless; `platform-tools\adb.exe` still connects).

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
