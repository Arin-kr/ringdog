# RingDog Android App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native Android client (`apps/android-app`) for the RingDog shopping app's core flow (signup/login, browse products, cart, checkout, order history), instrumented end-to-end with Datadog RUM, Trace, and Logs, reusing the existing `backend-api` unchanged.

**Architecture:** Single-module Kotlin + Jetpack Compose app, MVVM (`ui/` Composables+ViewModels, `data/` Repositories+API, `domain/` implicit in DTOs). Retrofit+OkHttp talk to `backend-api`'s existing REST endpoints; `dd-sdk-android` (RUM+Trace+Logs, agentless) instruments the app, with an OkHttp `DatadogInterceptor` linking mobile network calls into the same distributed trace as the backend's `dd-trace` spans.

**Tech Stack:** Kotlin 2.0.20, Jetpack Compose (BOM 2024.09.00), Navigation Compose 2.7.7, Retrofit 2.11.0 + OkHttp 4.12.0 + Gson, `androidx.security:security-crypto` (EncryptedSharedPreferences), `dd-sdk-android` 2.14.0 (`rum`, `trace`, `logs`, `okhttp` modules), JUnit4 + MockK + Turbine + OkHttp MockWebServer for tests, AGP 8.5.2.

**Spec:** `docs/superpowers/specs/2026-08-25-android-app-design.md`

## Global Constraints

- v1 feature scope is signup/login, product list/detail, cart, checkout, order history/detail only — `chatbot-service` is explicitly out of scope.
- `backend-api` must not be modified — the Android app is a pure REST client of the existing, already-deployed API surface.
- The `demo` build flavor's `BASE_URL` must never be hardcoded in `build.gradle.kts` — it is injected at build time via a `-PDEMO_BASE_URL` Gradle property (see spec's "Environment switching" section), because the EKS ALB hostname changes on every `terraform apply`.
- Mobile Datadog credentials are baked in at build time (normal for mobile, unlike the web frontend's runtime-injection workaround) via `local.properties` (local dev) or `-P` Gradle properties sourced from GitHub Secrets (demo builds) — never hardcoded in versioned files.
- ViewModel/Repository/interceptor logic gets real unit tests (JUnit+MockK+Turbine+MockWebServer). Compose UI screens and RUM event delivery are verified by building and manually running through the flow — no automated Compose UI tests, per the spec's testing-scope decision.
- No Android CI pipeline exists or is planned in this scope; demo builds are a manual pre-demo step.

---

## Task 1: Project scaffolding — Gradle project, flavors, gitignore

**Files:**
- Create: `apps/android-app/settings.gradle.kts`
- Create: `apps/android-app/build.gradle.kts` (root/project-level)
- Create: `apps/android-app/gradle.properties`
- Create: `apps/android-app/app/build.gradle.kts`
- Create: `apps/android-app/app/src/main/AndroidManifest.xml`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/MainActivity.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/theme/Theme.kt`
- Create: `apps/android-app/local.properties.example`
- Create: `apps/android-app/gradlew`, `apps/android-app/gradlew.bat`, `apps/android-app/gradle/wrapper/gradle-wrapper.properties`, `apps/android-app/gradle/wrapper/gradle-wrapper.jar` (generated, not hand-written — see Step 11)
- Modify: `.gitignore` (repo root)

**Interfaces:**
- Produces: Gradle product flavors `local`/`demo` exposing `BuildConfig.BASE_URL: String`, `BuildConfig.DD_RUM_APPLICATION_ID: String`, `BuildConfig.DD_RUM_CLIENT_TOKEN: String`. Package `com.ringdog.android`. A `RingDogTheme` composable (Material3) that later tasks wrap their UI in.

This is a scaffolding task — no business logic yet, so the "test" is a successful build.

- [ ] **Step 1: Add Android entries to the repo root `.gitignore`**

Check the current root `.gitignore` first, then append (it currently has no Android-specific entries — this is the first Android app in the monorepo, and `local.properties` will hold Datadog credentials, so this must land before any other Android file is created):

```gitignore

# Android (apps/android-app)
apps/android-app/local.properties
apps/android-app/**/build/
apps/android-app/.gradle/
apps/android-app/.idea/
apps/android-app/*.iml
apps/android-app/app/*.iml
apps/android-app/captures/
apps/android-app/.cxx/
*.apk
*.aab
```

- [ ] **Step 2: Create `apps/android-app/settings.gradle.kts`**

```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "ringdog-android"
include(":app")
```

- [ ] **Step 3: Create `apps/android-app/build.gradle.kts` (empty root build file, plugins declared with `apply false`)**

```kotlin
plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.20" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.20" apply false
}
```

- [ ] **Step 4: Create `apps/android-app/gradle.properties`**

```properties
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
```

- [ ] **Step 5: Create `apps/android-app/local.properties.example`**

```properties
# Copy to local.properties (gitignored) and fill in real values.
# sdk.dir is normally auto-written by Android Studio on first sync.

# Datadog RUM → Manage Applications → create an "Android" application to get these:
DD_RUM_APPLICATION_ID=
DD_RUM_CLIENT_TOKEN=

# Only used by the `demo` flavor if you want a stable local override instead of
# passing -PDEMO_BASE_URL on the command line. Must be a bare host (no scheme).
DEMO_BASE_URL=
```

- [ ] **Step 6: Create `apps/android-app/app/build.gradle.kts`**

```kotlin
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

fun localOrProjectProperty(key: String, default: String = ""): String =
    (project.findProperty(key) as String?) ?: localProperties.getProperty(key, default)

android {
    namespace = "com.ringdog.android"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ringdog.android"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    flavorDimensions += "environment"
    productFlavors {
        create("local") {
            dimension = "environment"
            buildConfigField("String", "BASE_URL", "\"http://10.0.2.2:4000/\"")
            buildConfigField(
                "String",
                "DD_RUM_APPLICATION_ID",
                "\"${localProperties.getProperty("DD_RUM_APPLICATION_ID", "")}\"",
            )
            buildConfigField(
                "String",
                "DD_RUM_CLIENT_TOKEN",
                "\"${localProperties.getProperty("DD_RUM_CLIENT_TOKEN", "")}\"",
            )
        }
        create("demo") {
            dimension = "environment"
            val demoHost = localOrProjectProperty("DEMO_BASE_URL", "REPLACE_ME.invalid")
            buildConfigField("String", "BASE_URL", "\"https://$demoHost/\"")
            buildConfigField(
                "String",
                "DD_RUM_APPLICATION_ID",
                "\"${localOrProjectProperty("DD_RUM_APPLICATION_ID_ANDROID")}\"",
            )
            buildConfigField(
                "String",
                "DD_RUM_CLIENT_TOKEN",
                "\"${localOrProjectProperty("DD_RUM_CLIENT_TOKEN_ANDROID")}\"",
            )
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")
    implementation("androidx.navigation:navigation-compose:2.7.7")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    implementation("com.datadoghq:dd-sdk-android-rum:2.14.0")
    implementation("com.datadoghq:dd-sdk-android-trace:2.14.0")
    implementation("com.datadoghq:dd-sdk-android-logs:2.14.0")
    implementation("com.datadoghq:dd-sdk-android-okhttp:2.14.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("io.mockk:mockk:1.13.11")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    testImplementation("app.cash.turbine:turbine:1.1.0")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
```

- [ ] **Step 7: Create `apps/android-app/app/src/main/AndroidManifest.xml`**

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:name=".RingDogApplication"
        android:allowBackup="false"
        android:label="RingDog"
        android:theme="@style/Theme.Material3.DayNight.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

`RingDogApplication` doesn't exist yet — it's created in Task 2. This manifest step is committed together with a temporary no-op `RingDogApplication` so the app builds; Task 2 replaces its body.

- [ ] **Step 8: Create a temporary no-op `RingDogApplication` (Task 2 will fill this in)**

`apps/android-app/app/src/main/java/com/ringdog/android/RingDogApplication.kt`:

```kotlin
package com.ringdog.android

import android.app.Application

class RingDogApplication : Application()
```

- [ ] **Step 9: Create `apps/android-app/app/src/main/java/com/ringdog/android/ui/theme/Theme.kt`**

```kotlin
package com.ringdog.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme()
private val DarkColors = darkColorScheme()

@Composable
fun RingDogTheme(content: @Composable () -> Unit) {
    val colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors
    MaterialTheme(colorScheme = colorScheme, content = content)
}
```

- [ ] **Step 10: Create `apps/android-app/app/src/main/java/com/ringdog/android/MainActivity.kt` (placeholder — Task 9 replaces the body with real navigation)**

```kotlin
package com.ringdog.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.ringdog.android.ui.theme.RingDogTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            RingDogTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    Placeholder()
                }
            }
        }
    }
}

@Composable
private fun Placeholder() {
    Text("RingDog")
}
```

- [ ] **Step 11: Generate the Gradle wrapper**

The project has no `gradlew`/`gradlew.bat` yet — every later task's "run `./gradlew ...`" step depends on this existing. This machine has a standalone Gradle 8.9 already extracted at
`C:\Users\MZC01-ARINAN\AppData\Local\Android\gradle-8.9` (set up as a one-time environment step, outside this repo) purely to bootstrap the wrapper — it is not otherwise part of this project.

From `apps/android-app/`, run:

```bash
JAVA_HOME="/c/Users/MZC01-ARINAN/AppData/Local/Programs/Microsoft/jdk-17.0.10.7-hotspot" \
  "/c/Users/MZC01-ARINAN/AppData/Local/Android/gradle-8.9/bin/gradle.bat" wrapper --gradle-version 8.9 --distribution-type bin
```

Expected: creates `gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar`, `gradle/wrapper/gradle-wrapper.properties`. Commit all four — the wrapper jar is a binary file and is normally committed for Gradle projects (this is how every consumer of the repo, including CI later, gets the exact same Gradle version without installing it separately).

- [ ] **Step 12: Point the project at the installed Android SDK**

Add a `sdk.dir` line to `apps/android-app/local.properties` (create the file now if it doesn't exist yet from Step 5's example — it's gitignored, so this is a one-line file for now until Datadog credentials are added later):

```properties
sdk.dir=C\:\\Users\\MZC01-ARINAN\\AppData\\Local\\Android\\Sdk
```

This machine has no persistent `ANDROID_HOME` environment variable, so `sdk.dir` in `local.properties` is how the Android Gradle Plugin finds the SDK (the standard mechanism — this is exactly what Android Studio itself writes here on a normal setup).

- [ ] **Step 13: Verify the project builds**

This machine also has no persistent `JAVA_HOME` — every `./gradlew` invocation in this and every later task must be prefixed exactly like this:

```bash
JAVA_HOME="/c/Users/MZC01-ARINAN/AppData/Local/Programs/Microsoft/jdk-17.0.10.7-hotspot" ./gradlew :app:assembleLocalDebug
```

Run (from `apps/android-app/`) the command above.
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 14: Commit**

```bash
git add .gitignore apps/android-app
git commit -m "feat(android): scaffold Android app project (Gradle, flavors, gitignore)"
```

`local.properties` itself is gitignored and will not be included — only the wrapper files, build config, manifest, and source files.

---

## Task 2: Datadog SDK initialization

**Files:**
- Modify: `apps/android-app/app/src/main/java/com/ringdog/android/RingDogApplication.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/datadog/DatadogInitializer.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/datadog/AppLogger.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/datadog/DatadogInitializerTest.kt`

**Interfaces:**
- Consumes: `BuildConfig.DD_RUM_APPLICATION_ID`, `BuildConfig.DD_RUM_CLIENT_TOKEN`, `BuildConfig.FLAVOR` (from Task 1)
- Produces: `DatadogInitializer.initialize(application: Application)` — called once from `RingDogApplication.onCreate()`. `DatadogInitializer.resolveEnvironmentName(flavor: String): String` — pure function later tasks don't need directly, but documents the env-naming convention (`"local"` / `"demo"`) used as Datadog's `env` tag. `AppLogger.info(message, attributes)` / `AppLogger.error(message, attributes)` — a thin wrapper around `dd-sdk-android-logs`'s `Logger`, consumed by Task 5's `AuthViewModel` and Task 8's `OrderHistoryViewModel` to satisfy the spec's "structured logs for key events (login success/failure, order failure)" requirement.

- [ ] **Step 1: Write the failing test for the pure environment-name mapping**

```kotlin
package com.ringdog.android.datadog

import org.junit.Assert.assertEquals
import org.junit.Test

class DatadogInitializerTest {

    @Test
    fun `demo flavor maps to demo environment name`() {
        assertEquals("demo", DatadogInitializer.resolveEnvironmentName("demo"))
    }

    @Test
    fun `local flavor maps to local environment name`() {
        assertEquals("local", DatadogInitializer.resolveEnvironmentName("local"))
    }

    @Test
    fun `unknown flavor falls back to local environment name`() {
        assertEquals("local", DatadogInitializer.resolveEnvironmentName("something-unexpected"))
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :app:testLocalDebugUnitTest --tests "com.ringdog.android.datadog.DatadogInitializerTest"`
Expected: FAIL — `DatadogInitializer` is unresolved.

- [ ] **Step 3: Implement `DatadogInitializer`**

```kotlin
package com.ringdog.android.datadog

import android.app.Application
import com.datadog.android.Datadog
import com.datadog.android.DatadogSite
import com.datadog.android.core.configuration.Configuration
import com.datadog.android.log.Logs
import com.datadog.android.log.LogsConfiguration
import com.datadog.android.privacy.TrackingConsent
import com.datadog.android.rum.Rum
import com.datadog.android.rum.RumConfiguration
import com.datadog.android.trace.Trace
import com.datadog.android.trace.TraceConfiguration
import com.ringdog.android.BuildConfig

object DatadogInitializer {

    fun resolveEnvironmentName(flavor: String): String = if (flavor == "demo") "demo" else "local"

    fun initialize(application: Application) {
        val environmentName = resolveEnvironmentName(BuildConfig.FLAVOR)

        val configuration = Configuration.Builder(
            clientToken = BuildConfig.DD_RUM_CLIENT_TOKEN,
            env = environmentName,
            variant = "",
        ).useSite(DatadogSite.US1).build()

        Datadog.initialize(application, configuration, TrackingConsent.GRANTED)

        val rumConfiguration = RumConfiguration.Builder(BuildConfig.DD_RUM_APPLICATION_ID)
            .trackUserInteractions()
            .trackLongTasks()
            .build()
        Rum.enable(rumConfiguration)

        Trace.enable(TraceConfiguration.Builder().build())
        Logs.enable(LogsConfiguration.Builder().build())
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :app:testLocalDebugUnitTest --tests "com.ringdog.android.datadog.DatadogInitializerTest"`
Expected: PASS (3 tests). Note `resolveEnvironmentName` is a pure function with no Android/Datadog SDK calls, so it runs on the plain JVM unit test runner without needing a real device or mocked `Datadog` singleton.

- [ ] **Step 5: Wire it into `RingDogApplication`**

```kotlin
package com.ringdog.android

import android.app.Application
import com.ringdog.android.datadog.DatadogInitializer

class RingDogApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        DatadogInitializer.initialize(this)
    }
}
```

- [ ] **Step 5b: Implement `AppLogger`**

```kotlin
package com.ringdog.android.datadog

import com.datadog.android.log.Logger

object AppLogger {
    private val logger: Logger by lazy {
        Logger.Builder()
            .setNetworkInfoEnabled(true)
            .setLogcatLogsEnabled(true)
            .setRemoteSampleRate(100f)
            .setBundleWithRumEnabled(true)
            .build()
    }

    fun info(message: String, attributes: Map<String, Any?> = emptyMap()) {
        logger.i(message, attributes = attributes)
    }

    fun error(message: String, attributes: Map<String, Any?> = emptyMap()) {
        logger.e(message, attributes = attributes)
    }
}
```

`setBundleWithRumEnabled(true)` attaches the active RUM view/session context to every log line automatically, matching the spec's "RUM context is attached automatically" requirement — no manual trace/session id plumbing needed.

- [ ] **Step 6: Verify the app still builds**

Run: `./gradlew :app:assembleLocalDebug`
Expected: `BUILD SUCCESSFUL`. (Manual verification that the SDK actually initializes without crashing happens once the app is runnable end-to-end, in Task 9 — an empty `DD_RUM_CLIENT_TOKEN`/`DD_RUM_APPLICATION_ID` from an unfilled `local.properties` will not crash `Datadog.initialize`, it will just not report data, which is expected until real credentials are added.)

- [ ] **Step 7: Commit**

```bash
git add apps/android-app/app/src/main/java/com/ringdog/android/RingDogApplication.kt apps/android-app/app/src/main/java/com/ringdog/android/datadog apps/android-app/app/src/test/java/com/ringdog/android/datadog
git commit -m "feat(android): initialize Datadog RUM/Trace/Logs SDK and add AppLogger wrapper"
```

---

## Task 3: Data layer foundations — ApiResult, DTOs, Retrofit API interfaces

**Files:**
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/ApiResult.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/remote/dto/AuthDtos.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/remote/dto/ProductDtos.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/remote/dto/CartDtos.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/remote/dto/OrderDtos.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/remote/dto/ApiErrorDtos.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/remote/api/AuthApi.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/remote/api/ProductApi.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/remote/api/CartApi.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/remote/api/OrderApi.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/data/remote/dto/DtoSerializationTest.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/data/ApiResultTest.kt`

**Interfaces:**
- Produces: `ApiResult<T>` sealed class (`Success<T>(data: T)`, `Error(message: String, code: Int?)`), `suspend fun <T> safeApiCall(call: suspend () -> retrofit2.Response<T>): ApiResult<T>`, plus all DTOs and `AuthApi`/`ProductApi`/`CartApi`/`OrderApi` Retrofit interfaces described below. Every later task's Repository consumes exactly these.

**Backend response shapes (confirmed by reading `apps/backend-api/src/routes/*.ts` and `packages/db/prisma/schema.prisma`):** Prisma-serialized objects use camelCase keys matching the Kotlin property names directly (`imageUrl`, `createdAt`, `userId`, `totalAmount`, `unitPrice`, …) — no `@SerializedName` needed for those. The three hand-built JSON responses (`signup`, `login`, `checkout`) use snake_case for some fields and DO need `@SerializedName`. Prisma `Decimal` fields (`price`, `totalAmount`, `unitPrice`) serialize as JSON **strings**, except `checkout`'s `total_amount`, which is built with `Number(...)` and serializes as a JSON **number**. All DTOs below encode this exactly.

- [ ] **Step 1: Write the failing DTO serialization tests**

```kotlin
package com.ringdog.android.data.remote.dto

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DtoSerializationTest {

    private val gson = Gson()

    @Test
    fun `SignupResponse maps snake_case created_at`() {
        val json = """{"id":"u1","email":"a@b.com","role":"customer","created_at":"2026-01-01T00:00:00.000Z"}"""
        val result = gson.fromJson(json, SignupResponse::class.java)
        assertEquals("2026-01-01T00:00:00.000Z", result.createdAt)
    }

    @Test
    fun `LoginResponse maps snake_case expires_in`() {
        val json = """{"token":"jwt-abc","expires_in":"1h"}"""
        val result = gson.fromJson(json, LoginResponse::class.java)
        assertEquals("jwt-abc", result.token)
        assertEquals("1h", result.expiresIn)
    }

    @Test
    fun `ProductDto price is kept as a string to preserve Decimal precision`() {
        val json = """{"id":"p1","name":"Ring","description":"desc","price":"19.99","stock":5,"tags":["cute"],"imageUrl":null,"createdAt":"2026-01-01T00:00:00.000Z"}"""
        val result = gson.fromJson(json, ProductDto::class.java)
        assertEquals("19.99", result.price)
        assertNull(result.imageUrl)
    }

    @Test
    fun `AddCartItemRequest serializes to snake_case product_id`() {
        val json = gson.toJson(AddCartItemRequest(productId = "p1", quantity = 2))
        assertEquals(true, json.contains("\"product_id\":\"p1\""))
    }

    @Test
    fun `CartItemDto product is nullable because POST cart items does not include it`() {
        val json = """{"id":"c1","userId":"u1","productId":"p1","quantity":2,"createdAt":"2026-01-01T00:00:00.000Z"}"""
        val result = gson.fromJson(json, CartItemDto::class.java)
        assertNull(result.product)
    }

    @Test
    fun `CheckoutResponse maps snake_case order_id and numeric total_amount`() {
        val json = """{"order_id":"o1","status":"PENDING","total_amount":39.98}"""
        val result = gson.fromJson(json, CheckoutResponse::class.java)
        assertEquals("o1", result.orderId)
        assertEquals(39.98, result.totalAmount, 0.001)
    }

    @Test
    fun `OrderDto keeps totalAmount as a string like the GET endpoints return it`() {
        val json = """{"id":"o1","userId":"u1","totalAmount":"39.98","couponCode":null,"status":"PENDING","createdAt":"2026-01-01T00:00:00.000Z","items":[]}"""
        val result = gson.fromJson(json, OrderDto::class.java)
        assertEquals("39.98", result.totalAmount)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew :app:testLocalDebugUnitTest --tests "com.ringdog.android.data.remote.dto.DtoSerializationTest"`
Expected: FAIL — none of the DTO classes exist yet.

- [ ] **Step 3: Implement the DTOs**

`data/remote/dto/AuthDtos.kt`:

```kotlin
package com.ringdog.android.data.remote.dto

import com.google.gson.annotations.SerializedName

data class SignupRequest(val email: String, val password: String)

data class SignupResponse(
    val id: String,
    val email: String,
    val role: String,
    @SerializedName("created_at") val createdAt: String,
)

data class LoginRequest(val email: String, val password: String)

data class LoginResponse(
    val token: String,
    @SerializedName("expires_in") val expiresIn: String,
)
```

`data/remote/dto/ProductDtos.kt`:

```kotlin
package com.ringdog.android.data.remote.dto

data class ProductDto(
    val id: String,
    val name: String,
    val description: String,
    val price: String,
    val stock: Int,
    val tags: List<String>,
    val imageUrl: String?,
    val createdAt: String,
)

data class ProductListResponse(
    val items: List<ProductDto>,
    val page: Int,
    val limit: Int,
    val total: Int,
)
```

`data/remote/dto/CartDtos.kt`:

```kotlin
package com.ringdog.android.data.remote.dto

import com.google.gson.annotations.SerializedName

data class AddCartItemRequest(
    @SerializedName("product_id") val productId: String,
    val quantity: Int,
)

data class CartItemDto(
    val id: String,
    val userId: String,
    val productId: String,
    val quantity: Int,
    val createdAt: String,
    // Present on GET /api/cart (includes the product relation); null on the
    // POST /api/cart/items response, which returns the raw upserted row.
    val product: ProductDto? = null,
)

data class CartListResponse(val items: List<CartItemDto>)
```

`data/remote/dto/OrderDtos.kt`:

```kotlin
package com.ringdog.android.data.remote.dto

import com.google.gson.annotations.SerializedName

data class CheckoutRequest(@SerializedName("coupon_code") val couponCode: String? = null)

data class CheckoutResponse(
    @SerializedName("order_id") val orderId: String,
    val status: String,
    @SerializedName("total_amount") val totalAmount: Double,
)

data class OrderItemDto(
    val id: String,
    val orderId: String,
    val productId: String,
    val quantity: Int,
    val unitPrice: String,
    val product: ProductDto,
)

data class OrderDto(
    val id: String,
    val userId: String,
    val totalAmount: String,
    val couponCode: String?,
    val status: String,
    val createdAt: String,
    val items: List<OrderItemDto>,
)

data class OrderListResponse(val items: List<OrderDto>)
```

`data/remote/dto/ApiErrorDtos.kt`:

```kotlin
package com.ringdog.android.data.remote.dto

data class ApiErrorResponse(val error: ApiErrorDetail)

data class ApiErrorDetail(val message: String)
```

- [ ] **Step 4: Implement the Retrofit API interfaces**

`data/remote/api/AuthApi.kt`:

```kotlin
package com.ringdog.android.data.remote.api

import com.ringdog.android.data.remote.dto.LoginRequest
import com.ringdog.android.data.remote.dto.LoginResponse
import com.ringdog.android.data.remote.dto.SignupRequest
import com.ringdog.android.data.remote.dto.SignupResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApi {
    @POST("api/auth/signup")
    suspend fun signup(@Body request: SignupRequest): Response<SignupResponse>

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>
}
```

`data/remote/api/ProductApi.kt`:

```kotlin
package com.ringdog.android.data.remote.api

import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.remote.dto.ProductListResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface ProductApi {
    @GET("api/products")
    suspend fun getProducts(@Query("page") page: Int, @Query("limit") limit: Int): Response<ProductListResponse>

    @GET("api/products/{id}")
    suspend fun getProduct(@Path("id") id: String): Response<ProductDto>
}
```

`data/remote/api/CartApi.kt`:

```kotlin
package com.ringdog.android.data.remote.api

import com.ringdog.android.data.remote.dto.AddCartItemRequest
import com.ringdog.android.data.remote.dto.CartItemDto
import com.ringdog.android.data.remote.dto.CartListResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface CartApi {
    @GET("api/cart")
    suspend fun getCart(): Response<CartListResponse>

    @POST("api/cart/items")
    suspend fun addItem(@Body request: AddCartItemRequest): Response<CartItemDto>

    @DELETE("api/cart/items/{id}")
    suspend fun removeItem(@Path("id") id: String): Response<Unit>
}
```

`data/remote/api/OrderApi.kt`:

```kotlin
package com.ringdog.android.data.remote.api

import com.ringdog.android.data.remote.dto.CheckoutRequest
import com.ringdog.android.data.remote.dto.CheckoutResponse
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.remote.dto.OrderListResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

interface OrderApi {
    @POST("api/orders/checkout")
    suspend fun checkout(@Body request: CheckoutRequest): Response<CheckoutResponse>

    @GET("api/orders")
    suspend fun getOrders(): Response<OrderListResponse>

    @GET("api/orders/{id}")
    suspend fun getOrder(@Path("id") id: String): Response<OrderDto>

    @PATCH("api/orders/{id}/cancel")
    suspend fun cancelOrder(@Path("id") id: String): Response<OrderDto>
}
```

- [ ] **Step 5: Run DTO tests to verify they pass**

Run: `./gradlew :app:testLocalDebugUnitTest --tests "com.ringdog.android.data.remote.dto.DtoSerializationTest"`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the failing test for `ApiResult`/`safeApiCall`**

```kotlin
package com.ringdog.android.data

import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response
import java.io.IOException

data class TestPayload(val value: String)

class ApiResultTest {

    @Test
    fun `returns Success when the call succeeds with a body`() = runTest {
        val result = safeApiCall { Response.success(TestPayload("hello")) }
        assertEquals(ApiResult.Success(TestPayload("hello")), result)
    }

    @Test
    fun `returns Error with the parsed backend message when the call fails`() = runTest {
        val errorJson = """{"error":{"message":"Product not found"}}"""
        val errorBody = errorJson.toResponseBody("application/json".toMediaType())
        val result = safeApiCall { Response.error<TestPayload>(404, errorBody) }
        assertTrue(result is ApiResult.Error)
        assertEquals("Product not found", (result as ApiResult.Error).message)
        assertEquals(404, result.code)
    }

    @Test
    fun `returns Error with a fallback message when the error body is not the expected shape`() = runTest {
        val errorBody = "not json".toResponseBody("text/plain".toMediaType())
        val result = safeApiCall { Response.error<TestPayload>(500, errorBody) } as ApiResult.Error
        assertEquals("Request failed with code 500", result.message)
    }

    @Test
    fun `returns Error when the call throws IOException`() = runTest {
        val result = safeApiCall<TestPayload> { throw IOException("no network") }
        assertTrue(result is ApiResult.Error)
        assertEquals("no network", (result as ApiResult.Error).message)
    }

    @Test
    fun `treats a successful null body as Success of Unit for no-content responses`() = runTest {
        val result = safeApiCall { Response.success<Unit>(null) }
        assertEquals(ApiResult.Success(Unit), result)
    }
}
```

- [ ] **Step 7: Run test to verify it fails**

Run: `./gradlew :app:testLocalDebugUnitTest --tests "com.ringdog.android.data.ApiResultTest"`
Expected: FAIL — `ApiResult`/`safeApiCall` unresolved.

- [ ] **Step 8: Implement `ApiResult` and `safeApiCall`**

```kotlin
package com.ringdog.android.data

import com.google.gson.Gson
import com.ringdog.android.data.remote.dto.ApiErrorResponse
import retrofit2.Response
import java.io.IOException

sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val message: String, val code: Int? = null) : ApiResult<Nothing>()
}

suspend fun <T> safeApiCall(call: suspend () -> Response<T>): ApiResult<T> {
    return try {
        val response = call()
        if (response.isSuccessful) {
            // DELETE endpoints return 204 with a null body; safe to coerce to
            // Unit since callers of a Response<Unit> endpoint expect exactly that.
            @Suppress("UNCHECKED_CAST")
            ApiResult.Success((response.body() ?: Unit) as T)
        } else {
            val message = response.errorBody()?.string()?.let { raw ->
                runCatching { Gson().fromJson(raw, ApiErrorResponse::class.java).error.message }.getOrNull()
            } ?: "Request failed with code ${response.code()}"
            ApiResult.Error(message, response.code())
        }
    } catch (e: IOException) {
        ApiResult.Error(e.message ?: "Network error")
    }
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `./gradlew :app:testLocalDebugUnitTest --tests "com.ringdog.android.data.ApiResultTest"`
Expected: PASS (5 tests).

- [ ] **Step 10: Commit**

```bash
git add apps/android-app/app/src/main/java/com/ringdog/android/data apps/android-app/app/src/test/java/com/ringdog/android/data
git commit -m "feat(android): add ApiResult, DTOs, and Retrofit API interfaces for backend-api"
```

---

## Task 4: Networking infrastructure — TokenStore, interceptors, NetworkModule

**Files:**
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/local/TokenStore.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/remote/AuthInterceptor.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/remote/SessionExpiryInterceptor.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/remote/AuthEventBus.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/remote/NetworkModule.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/AppContainer.kt`
- Modify: `apps/android-app/app/src/main/java/com/ringdog/android/RingDogApplication.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/data/remote/AuthInterceptorTest.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/data/remote/SessionExpiryInterceptorTest.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/data/remote/AuthEventBusTest.kt`

**Interfaces:**
- Consumes: `AuthApi`/`ProductApi`/`CartApi`/`OrderApi` (Task 3)
- Produces: `TokenStore.init(context)`, `.saveToken(String)`, `.getToken(): String?`, `.clearToken()`, `.isLoggedIn(): Boolean`. `AuthEventBus.sessionExpired: SharedFlow<Unit>` and `.notifySessionExpired()`. `NetworkModule.authApi/productApi/cartApi/orderApi` (lazily-built Retrofit services). `AppContainer` — an empty object that Tasks 5–8 each add one repository property to.

Note on design: the spec described this as an OkHttp `Authenticator`, but `Authenticator` is OkHttp's mechanism for supplying new credentials on a 401 for a *retry* — this backend has no refresh-token flow, so there's nothing to retry with. A response-inspecting `Interceptor` is the correct OkHttp primitive for "notice a 401 happened and react to it" without attempting a retry; behavior matches the spec's intent exactly (clear the token, signal the UI to return to login).

- [ ] **Step 1: Write the failing test for `AuthInterceptor`**

```kotlin
package com.ringdog.android.data.remote

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class AuthInterceptorTest {

    private val server = MockWebServer()

    @Before
    fun setUp() {
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `attaches Authorization header when a token is present`() {
        server.enqueue(MockResponse().setResponseCode(200))
        val client = OkHttpClient.Builder().addInterceptor(AuthInterceptor { "jwt-123" }).build()

        client.newCall(Request.Builder().url(server.url("/ping")).build()).execute()

        val recorded = server.takeRequest()
        assertEquals("Bearer jwt-123", recorded.getHeader("Authorization"))
    }

    @Test
    fun `does not attach Authorization header when no token is present`() {
        server.enqueue(MockResponse().setResponseCode(200))
        val client = OkHttpClient.Builder().addInterceptor(AuthInterceptor { null }).build()

        client.newCall(Request.Builder().url(server.url("/ping")).build()).execute()

        val recorded = server.takeRequest()
        assertNull(recorded.getHeader("Authorization"))
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :app:testLocalDebugUnitTest --tests "com.ringdog.android.data.remote.AuthInterceptorTest"`
Expected: FAIL — `AuthInterceptor` unresolved.

- [ ] **Step 3: Implement `AuthInterceptor`**

```kotlin
package com.ringdog.android.data.remote

import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(private val tokenProvider: () -> String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val token = tokenProvider()
        val request = if (token != null) {
            original.newBuilder().addHeader("Authorization", "Bearer $token").build()
        } else {
            original
        }
        return chain.proceed(request)
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :app:testLocalDebugUnitTest --tests "com.ringdog.android.data.remote.AuthInterceptorTest"`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing test for `SessionExpiryInterceptor`**

```kotlin
package com.ringdog.android.data.remote

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

class SessionExpiryInterceptorTest {

    private val server = MockWebServer()

    @Before
    fun setUp() {
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `invokes callback exactly once on a 401 response`() {
        server.enqueue(MockResponse().setResponseCode(401))
        val callCount = AtomicInteger(0)
        val client = OkHttpClient.Builder()
            .addInterceptor(SessionExpiryInterceptor { callCount.incrementAndGet() })
            .build()

        client.newCall(Request.Builder().url(server.url("/secure")).build()).execute()

        assertEquals(1, callCount.get())
    }

    @Test
    fun `does not invoke callback on a 200 response`() {
        server.enqueue(MockResponse().setResponseCode(200))
        val callCount = AtomicInteger(0)
        val client = OkHttpClient.Builder()
            .addInterceptor(SessionExpiryInterceptor { callCount.incrementAndGet() })
            .build()

        client.newCall(Request.Builder().url(server.url("/secure")).build()).execute()

        assertEquals(0, callCount.get())
    }
}
```

- [ ] **Step 6: Run test to verify it fails, then implement `SessionExpiryInterceptor`**

Run: `./gradlew :app:testLocalDebugUnitTest --tests "com.ringdog.android.data.remote.SessionExpiryInterceptorTest"` — expect FAIL (unresolved reference).

```kotlin
package com.ringdog.android.data.remote

import okhttp3.Interceptor
import okhttp3.Response

class SessionExpiryInterceptor(private val onSessionExpired: () -> Unit) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        if (response.code == 401) {
            onSessionExpired()
        }
        return response
    }
}
```

Run again: expect PASS (2 tests).

- [ ] **Step 7: Write the failing test for `AuthEventBus`**

```kotlin
package com.ringdog.android.data.remote

import app.cash.turbine.test
import kotlinx.coroutines.test.runTest
import org.junit.Test

class AuthEventBusTest {

    @Test
    fun `notifySessionExpired emits an event to collectors`() = runTest {
        AuthEventBus.sessionExpired.test {
            AuthEventBus.notifySessionExpired()
            awaitItem()
        }
    }
}
```

- [ ] **Step 8: Run test to verify it fails, then implement `AuthEventBus`**

Run: expect FAIL (unresolved reference).

```kotlin
package com.ringdog.android.data.remote

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

object AuthEventBus {
    private val _sessionExpired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val sessionExpired: SharedFlow<Unit> = _sessionExpired.asSharedFlow()

    fun notifySessionExpired() {
        _sessionExpired.tryEmit(Unit)
    }
}
```

Run again: expect PASS (1 test).

- [ ] **Step 9: Implement `TokenStore` (not unit-tested — it wraps `EncryptedSharedPreferences`, which needs a real Android Keystore; it's covered by the Task 9 manual end-to-end run instead)**

```kotlin
package com.ringdog.android.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object TokenStore {
    private const val PREFS_NAME = "ringdog_secure_prefs"
    private const val KEY_TOKEN = "auth_token"

    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun saveToken(token: String) {
        prefs.edit().putString(KEY_TOKEN, token).apply()
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    fun clearToken() {
        prefs.edit().remove(KEY_TOKEN).apply()
    }

    fun isLoggedIn(): Boolean = getToken() != null
}
```

- [ ] **Step 10: Implement `NetworkModule`**

```kotlin
package com.ringdog.android.data.remote

import com.datadog.android.okhttp.DatadogInterceptor
import com.datadog.android.okhttp.trace.TracingHeaderType
import com.google.gson.Gson
import com.ringdog.android.BuildConfig
import com.ringdog.android.data.local.TokenStore
import com.ringdog.android.data.remote.api.AuthApi
import com.ringdog.android.data.remote.api.CartApi
import com.ringdog.android.data.remote.api.OrderApi
import com.ringdog.android.data.remote.api.ProductApi
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object NetworkModule {

    private val tracedHost: String = BuildConfig.BASE_URL.toHttpUrl().host

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
    }

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor { TokenStore.getToken() })
            .addInterceptor(DatadogInterceptor(tracedHosts = mapOf(tracedHost to setOf(TracingHeaderType.DATADOG))))
            .addInterceptor(SessionExpiryInterceptor { AuthEventBus.notifySessionExpired() })
            .addInterceptor(loggingInterceptor)
            .build()
    }

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BuildConfig.BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(Gson()))
            .build()
    }

    val authApi: AuthApi by lazy { retrofit.create(AuthApi::class.java) }
    val productApi: ProductApi by lazy { retrofit.create(ProductApi::class.java) }
    val cartApi: CartApi by lazy { retrofit.create(CartApi::class.java) }
    val orderApi: OrderApi by lazy { retrofit.create(OrderApi::class.java) }
}
```

`DatadogInterceptor`'s `tracedHosts` restricts distributed-trace header injection to `backend-api`'s own host, so trace headers are never leaked to any third-party host the app might call in the future.

- [ ] **Step 11: Create the `AppContainer` skeleton**

```kotlin
package com.ringdog.android.data

// Repository singletons are added here one at a time as each domain area
// (auth, cart, product, order) is implemented in later tasks.
object AppContainer
```

- [ ] **Step 12: Wire `TokenStore.init` into `RingDogApplication`**

```kotlin
package com.ringdog.android

import android.app.Application
import com.ringdog.android.data.local.TokenStore
import com.ringdog.android.datadog.DatadogInitializer

class RingDogApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        TokenStore.init(this)
        DatadogInitializer.initialize(this)
    }
}
```

- [ ] **Step 13: Verify the full unit test suite and the build both pass**

Run: `./gradlew :app:testLocalDebugUnitTest`
Expected: all tests PASS (from this task and Tasks 2–3).

Run: `./gradlew :app:assembleLocalDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 14: Commit**

```bash
git add apps/android-app/app/src/main/java/com/ringdog/android/data apps/android-app/app/src/main/java/com/ringdog/android/RingDogApplication.kt apps/android-app/app/src/test/java/com/ringdog/android/data
git commit -m "feat(android): add TokenStore, auth/session interceptors, and NetworkModule"
```

---

## Task 5: Auth feature — repository, view model, screens

**Files:**
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/repository/AuthRepository.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/auth/AuthViewModel.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/auth/LoginScreen.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/auth/SignupScreen.kt`
- Modify: `apps/android-app/app/src/main/java/com/ringdog/android/data/AppContainer.kt`
- Create: `apps/android-app/app/src/test/java/com/ringdog/android/MainDispatcherRule.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/data/repository/AuthRepositoryTest.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/ui/auth/AuthViewModelTest.kt`

**Interfaces:**
- Consumes: `AuthApi` (Task 3), `ApiResult`/`safeApiCall` (Task 3), `AppContainer` (Task 4), `AppLogger` (Task 2)
- Produces: `AuthRepository(api, onTokenReceived, onLogout)` with `suspend fun signup(email, password): ApiResult<SignupResponse>`, `suspend fun login(email, password): ApiResult<LoginResponse>`, `fun logout()`. `AppContainer.authRepository: AuthRepository`. `AuthViewModel(repository)` exposing `uiState: StateFlow<AuthUiState>` (`Idle`/`Loading`/`Success`/`Error(message)`) and `fun login(email, password)`/`fun signup(email, password)`. `LoginScreen`/`SignupScreen` composables — later consumed by Task 9's navigation graph.

- [ ] **Step 1: Create the shared `MainDispatcherRule` test utility (reused by every ViewModel test in later tasks too)**

```kotlin
package com.ringdog.android

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.rules.TestWatcher
import org.junit.runner.Description

class MainDispatcherRule(private val dispatcher: TestDispatcher = StandardTestDispatcher()) : TestWatcher() {
    override fun starting(description: Description) {
        Dispatchers.setMain(dispatcher)
    }

    override fun finished(description: Description) {
        Dispatchers.resetMain()
    }
}
```

- [ ] **Step 2: Write the failing test for `AuthRepository`**

```kotlin
package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.AuthApi
import com.ringdog.android.data.remote.dto.LoginResponse
import com.ringdog.android.data.remote.dto.SignupResponse
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

class AuthRepositoryTest {

    private val api = mockk<AuthApi>()

    @Test
    fun `login success stores the received token`() = runTest {
        var savedToken: String? = null
        val repository = AuthRepository(api, onTokenReceived = { savedToken = it })
        coEvery { api.login(any()) } returns Response.success(LoginResponse("jwt-123", "1h"))

        val result = repository.login("a@b.com", "password123")

        assertTrue(result is ApiResult.Success)
        assertEquals("jwt-123", savedToken)
    }

    @Test
    fun `login failure does not store a token`() = runTest {
        var savedToken: String? = null
        val repository = AuthRepository(api, onTokenReceived = { savedToken = it })
        val errorBody = """{"error":{"message":"Invalid email or password"}}"""
            .toResponseBody("application/json".toMediaType())
        coEvery { api.login(any()) } returns Response.error(401, errorBody)

        val result = repository.login("a@b.com", "wrong")

        assertTrue(result is ApiResult.Error)
        assertNull(savedToken)
    }

    @Test
    fun `signup delegates to the API without touching the token`() = runTest {
        var tokenTouched = false
        val repository = AuthRepository(api, onTokenReceived = { tokenTouched = true })
        coEvery { api.signup(any()) } returns Response.success(SignupResponse("u1", "a@b.com", "customer", "2026-01-01"))

        val result = repository.signup("a@b.com", "password123")

        assertTrue(result is ApiResult.Success)
        assertEquals(false, tokenTouched)
    }

    @Test
    fun `logout invokes the onLogout callback`() {
        var loggedOut = false
        val repository = AuthRepository(api, onLogout = { loggedOut = true })

        repository.logout()

        assertTrue(loggedOut)
    }
}
```

- [ ] **Step 3: Run test to verify it fails, then implement `AuthRepository`**

Run: expect FAIL (unresolved reference).

```kotlin
package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.local.TokenStore
import com.ringdog.android.data.remote.api.AuthApi
import com.ringdog.android.data.remote.dto.LoginRequest
import com.ringdog.android.data.remote.dto.LoginResponse
import com.ringdog.android.data.remote.dto.SignupRequest
import com.ringdog.android.data.remote.dto.SignupResponse
import com.ringdog.android.data.safeApiCall

class AuthRepository(
    private val api: AuthApi,
    private val onTokenReceived: (String) -> Unit = TokenStore::saveToken,
    private val onLogout: () -> Unit = TokenStore::clearToken,
) {
    suspend fun signup(email: String, password: String): ApiResult<SignupResponse> =
        safeApiCall { api.signup(SignupRequest(email, password)) }

    suspend fun login(email: String, password: String): ApiResult<LoginResponse> {
        val result = safeApiCall { api.login(LoginRequest(email, password)) }
        if (result is ApiResult.Success) {
            onTokenReceived(result.data.token)
        }
        return result
    }

    fun logout() = onLogout()
}
```

Run again: expect PASS (4 tests).

- [ ] **Step 4: Add `authRepository` to `AppContainer`**

```kotlin
package com.ringdog.android.data

import com.ringdog.android.data.remote.NetworkModule
import com.ringdog.android.data.repository.AuthRepository

object AppContainer {
    val authRepository: AuthRepository by lazy { AuthRepository(NetworkModule.authApi) }
}
```

- [ ] **Step 5: Write the failing test for `AuthViewModel`**

```kotlin
package com.ringdog.android.ui.auth

import app.cash.turbine.test
import com.ringdog.android.MainDispatcherRule
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.LoginResponse
import com.ringdog.android.data.repository.AuthRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class AuthViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val repository = mockk<AuthRepository>()

    @Test
    fun `login emits Loading then Success`() = runTest {
        coEvery { repository.login("a@b.com", "password123") } returns ApiResult.Success(LoginResponse("t", "1h"))
        val viewModel = AuthViewModel(repository)

        viewModel.uiState.test {
            assertEquals(AuthUiState.Idle, awaitItem())
            viewModel.login("a@b.com", "password123")
            assertEquals(AuthUiState.Loading, awaitItem())
            assertEquals(AuthUiState.Success, awaitItem())
        }
    }

    @Test
    fun `login emits Loading then Error on failure`() = runTest {
        coEvery { repository.login("a@b.com", "wrong") } returns ApiResult.Error("Invalid email or password", 401)
        val viewModel = AuthViewModel(repository)

        viewModel.uiState.test {
            assertEquals(AuthUiState.Idle, awaitItem())
            viewModel.login("a@b.com", "wrong")
            assertEquals(AuthUiState.Loading, awaitItem())
            assertEquals(AuthUiState.Error("Invalid email or password"), awaitItem())
        }
    }
}
```

- [ ] **Step 6: Run test to verify it fails, then implement `AuthViewModel`**

Run: expect FAIL (unresolved reference).

```kotlin
package com.ringdog.android.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.repository.AuthRepository
import com.ringdog.android.datadog.AppLogger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class AuthUiState {
    data object Idle : AuthUiState()
    data object Loading : AuthUiState()
    data object Success : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

class AuthViewModel(private val repository: AuthRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            _uiState.value = when (val result = repository.login(email, password)) {
                is ApiResult.Success -> {
                    AppLogger.info("login_success", mapOf("email" to email))
                    AuthUiState.Success
                }
                is ApiResult.Error -> {
                    AppLogger.error("login_failure", mapOf("email" to email, "reason" to result.message))
                    AuthUiState.Error(result.message)
                }
            }
        }
    }

    fun signup(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            _uiState.value = when (val result = repository.signup(email, password)) {
                is ApiResult.Success -> AuthUiState.Success
                is ApiResult.Error -> {
                    AppLogger.error("signup_failure", mapOf("email" to email, "reason" to result.message))
                    AuthUiState.Error(result.message)
                }
            }
        }
    }
}
```

Run again: expect PASS (2 tests) — the two existing tests don't stub or assert on `AppLogger`, and since it wraps a real `Logger` built lazily without requiring `Datadog.initialize()` to have run first (the underlying SDK core defaults to a no-op core until initialized), calling it in a plain JVM unit test is safe and simply logs nowhere.

- [ ] **Step 7: Implement `LoginScreen`**

```kotlin
package com.ringdog.android.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onLoginSuccess: () -> Unit,
    onNavigateToSignup: () -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.Success) onLoginSuccess()
    }

    Column(
        modifier = Modifier.fillMaxWidth().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("RingDog 로그인")
        OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("이메일") })
        OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("비밀번호") })

        if (uiState is AuthUiState.Error) {
            Text((uiState as AuthUiState.Error).message)
        }

        if (uiState is AuthUiState.Loading) {
            CircularProgressIndicator()
        } else {
            Button(
                onClick = { viewModel.login(email, password) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("로그인")
            }
        }

        TextButton(onClick = onNavigateToSignup) {
            Text("계정이 없으신가요? 회원가입")
        }
    }
}
```

- [ ] **Step 8: Implement `SignupScreen`**

```kotlin
package com.ringdog.android.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun SignupScreen(
    viewModel: AuthViewModel,
    onSignupSuccess: () -> Unit,
    onNavigateToLogin: () -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.Success) onSignupSuccess()
    }

    Column(
        modifier = Modifier.fillMaxWidth().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("RingDog 회원가입")
        OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("이메일") })
        OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("비밀번호 (8자 이상)") })

        if (uiState is AuthUiState.Error) {
            Text((uiState as AuthUiState.Error).message)
        }

        if (uiState is AuthUiState.Loading) {
            CircularProgressIndicator()
        } else {
            Button(
                onClick = { viewModel.signup(email, password) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("회원가입")
            }
        }

        TextButton(onClick = onNavigateToLogin) {
            Text("이미 계정이 있으신가요? 로그인")
        }
    }
}
```

- [ ] **Step 9: Run the full unit test suite and the build**

Run: `./gradlew :app:testLocalDebugUnitTest`
Expected: all tests PASS.

Run: `./gradlew :app:assembleLocalDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 10: Commit**

```bash
git add apps/android-app/app/src/main/java/com/ringdog/android/data/repository/AuthRepository.kt apps/android-app/app/src/main/java/com/ringdog/android/data/AppContainer.kt apps/android-app/app/src/main/java/com/ringdog/android/ui/auth apps/android-app/app/src/test/java/com/ringdog/android/MainDispatcherRule.kt apps/android-app/app/src/test/java/com/ringdog/android/data/repository apps/android-app/app/src/test/java/com/ringdog/android/ui/auth
git commit -m "feat(android): add auth repository, view model, and login/signup screens"
```

---

## Task 6: Cart feature — repository, view model, screen

**Files:**
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/repository/CartRepository.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/cart/CartViewModel.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/cart/CartScreen.kt`
- Modify: `apps/android-app/app/src/main/java/com/ringdog/android/data/AppContainer.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/data/repository/CartRepositoryTest.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/ui/cart/CartViewModelTest.kt`

**Interfaces:**
- Consumes: `CartApi` (Task 3), `ApiResult`/`safeApiCall` (Task 3), `AppContainer` (Task 4/5), `MainDispatcherRule` (Task 5)
- Produces: `CartRepository(api)` with `suspend fun getCart(): ApiResult<CartListResponse>`, `suspend fun removeItem(id): ApiResult<Unit>`. `AppContainer.cartRepository: CartRepository`. `CartViewModel(repository)` exposing `uiState: StateFlow<CartUiState>` and `fun loadCart()`/`fun removeFromCart(cartItemId)`. Task 7's `ProductDetailViewModel` calls `AppContainer.cartRepository.addItem(...)` directly (adding to cart happens on the product detail screen, not the cart screen) — `CartRepository.addItem` is defined here so Task 7 can consume it.

- [ ] **Step 1: Write the failing test for `CartRepository`**

```kotlin
package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.CartApi
import com.ringdog.android.data.remote.dto.CartItemDto
import com.ringdog.android.data.remote.dto.CartListResponse
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

class CartRepositoryTest {

    private val api = mockk<CartApi>()
    private val repository = CartRepository(api)

    @Test
    fun `getCart returns the items from a successful response`() = runTest {
        val item = CartItemDto(id = "c1", userId = "u1", productId = "p1", quantity = 2, createdAt = "2026-01-01")
        coEvery { api.getCart() } returns Response.success(CartListResponse(listOf(item)))

        val result = repository.getCart()

        assertTrue(result is ApiResult.Success)
        assertEquals(1, (result as ApiResult.Success).data.items.size)
    }

    @Test
    fun `addItem forwards product id and quantity`() = runTest {
        val item = CartItemDto(id = "c1", userId = "u1", productId = "p1", quantity = 3, createdAt = "2026-01-01")
        coEvery { api.addItem(any()) } returns Response.success(item)

        val result = repository.addItem("p1", 3)

        assertTrue(result is ApiResult.Success)
        assertEquals(3, (result as ApiResult.Success).data.quantity)
    }

    @Test
    fun `removeItem returns Success on 204`() = runTest {
        coEvery { api.removeItem("c1") } returns Response.success(null)

        val result = repository.removeItem("c1")

        assertTrue(result is ApiResult.Success)
    }
}
```

- [ ] **Step 2: Run test to verify it fails, then implement `CartRepository`**

Run: expect FAIL (unresolved reference).

```kotlin
package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.CartApi
import com.ringdog.android.data.remote.dto.AddCartItemRequest
import com.ringdog.android.data.remote.dto.CartItemDto
import com.ringdog.android.data.remote.dto.CartListResponse
import com.ringdog.android.data.safeApiCall

class CartRepository(private val api: CartApi) {
    suspend fun getCart(): ApiResult<CartListResponse> = safeApiCall { api.getCart() }

    suspend fun addItem(productId: String, quantity: Int): ApiResult<CartItemDto> =
        safeApiCall { api.addItem(AddCartItemRequest(productId, quantity)) }

    suspend fun removeItem(cartItemId: String): ApiResult<Unit> = safeApiCall { api.removeItem(cartItemId) }
}
```

Run again: expect PASS (3 tests).

- [ ] **Step 3: Add `cartRepository` to `AppContainer`**

```kotlin
package com.ringdog.android.data

import com.ringdog.android.data.remote.NetworkModule
import com.ringdog.android.data.repository.AuthRepository
import com.ringdog.android.data.repository.CartRepository

object AppContainer {
    val authRepository: AuthRepository by lazy { AuthRepository(NetworkModule.authApi) }
    val cartRepository: CartRepository by lazy { CartRepository(NetworkModule.cartApi) }
}
```

- [ ] **Step 4: Write the failing test for `CartViewModel`**

```kotlin
package com.ringdog.android.ui.cart

import app.cash.turbine.test
import com.ringdog.android.MainDispatcherRule
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.CartItemDto
import com.ringdog.android.data.remote.dto.CartListResponse
import com.ringdog.android.data.repository.CartRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class CartViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val repository = mockk<CartRepository>()
    private val item = CartItemDto(id = "c1", userId = "u1", productId = "p1", quantity = 1, createdAt = "2026-01-01")

    @Test
    fun `loads the cart on init`() = runTest {
        coEvery { repository.getCart() } returns ApiResult.Success(CartListResponse(listOf(item)))

        val viewModel = CartViewModel(repository)

        viewModel.uiState.test {
            assertEquals(listOf(item), awaitItem().items)
        }
    }

    @Test
    fun `removeFromCart reloads the cart on success`() = runTest {
        coEvery { repository.getCart() } returnsMany listOf(
            ApiResult.Success(CartListResponse(listOf(item))),
            ApiResult.Success(CartListResponse(emptyList())),
        )
        coEvery { repository.removeItem("c1") } returns ApiResult.Success(Unit)
        val viewModel = CartViewModel(repository)

        viewModel.uiState.test {
            assertEquals(1, awaitItem().items.size)
            viewModel.removeFromCart("c1")
            assertEquals(0, awaitItem().items.size)
        }
    }

    @Test
    fun `getCart failure surfaces an error message`() = runTest {
        coEvery { repository.getCart() } returns ApiResult.Error("Network error")

        val viewModel = CartViewModel(repository)

        viewModel.uiState.test {
            assertEquals("Network error", awaitItem().errorMessage)
        }
    }
}
```

- [ ] **Step 5: Run test to verify it fails, then implement `CartViewModel`**

Run: expect FAIL (unresolved reference).

```kotlin
package com.ringdog.android.ui.cart

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.CartItemDto
import com.ringdog.android.data.repository.CartRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CartUiState(
    val items: List<CartItemDto> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

class CartViewModel(private val repository: CartRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(CartUiState())
    val uiState: StateFlow<CartUiState> = _uiState.asStateFlow()

    init {
        loadCart()
    }

    fun loadCart() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.getCart()) {
                is ApiResult.Success -> _uiState.value = CartUiState(items = result.data.items)
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = result.message)
            }
        }
    }

    fun removeFromCart(cartItemId: String) {
        viewModelScope.launch {
            when (repository.removeItem(cartItemId)) {
                is ApiResult.Success -> loadCart()
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(errorMessage = "장바구니 항목 삭제에 실패했습니다")
            }
        }
    }
}
```

Run again: expect PASS (3 tests).

- [ ] **Step 6: Implement `CartScreen`**

```kotlin
package com.ringdog.android.ui.cart

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun CartScreen(viewModel: CartViewModel) {
    val uiState by viewModel.uiState.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("장바구니")

        if (uiState.isLoading) {
            CircularProgressIndicator()
        }

        uiState.errorMessage?.let { Text(it) }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(uiState.items, key = { it.id }) { item ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text("${item.product?.name ?: item.productId} x${item.quantity}")
                    TextButton(onClick = { viewModel.removeFromCart(item.id) }) {
                        Text("삭제")
                    }
                }
            }
        }
    }
}
```

`CartScreen` intentionally has no "checkout" button — Task 8/9 wires checkout as a separate action shown alongside the cart list, since it belongs to `OrderHistoryViewModel` (see Task 8's Interfaces section for why).

- [ ] **Step 7: Run the full unit test suite and the build**

Run: `./gradlew :app:testLocalDebugUnitTest`
Expected: all tests PASS.

Run: `./gradlew :app:assembleLocalDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 8: Commit**

```bash
git add apps/android-app/app/src/main/java/com/ringdog/android/data/repository/CartRepository.kt apps/android-app/app/src/main/java/com/ringdog/android/data/AppContainer.kt apps/android-app/app/src/main/java/com/ringdog/android/ui/cart apps/android-app/app/src/test/java/com/ringdog/android/data/repository/CartRepositoryTest.kt apps/android-app/app/src/test/java/com/ringdog/android/ui/cart
git commit -m "feat(android): add cart repository, view model, and screen"
```

---

## Task 7: Product feature — repository, view models, screens, RUM add-to-cart tagging

**Files:**
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/repository/ProductRepository.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/product/ProductListViewModel.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/product/ProductDetailViewModel.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/product/ProductListScreen.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/product/ProductDetailScreen.kt`
- Modify: `apps/android-app/app/src/main/java/com/ringdog/android/data/AppContainer.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/data/repository/ProductRepositoryTest.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/ui/product/ProductListViewModelTest.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/ui/product/ProductDetailViewModelTest.kt`

**Interfaces:**
- Consumes: `ProductApi` (Task 3), `CartRepository` (Task 6), `AppContainer` (Task 4/5/6), `MainDispatcherRule` (Task 5)
- Produces: `ProductRepository(api)` with `suspend fun getProducts(page, limit): ApiResult<ProductListResponse>`, `suspend fun getProduct(id): ApiResult<ProductDto>`. `AppContainer.productRepository: ProductRepository`. `ProductListViewModel(repository)` exposing `uiState: StateFlow<ProductListUiState>`. `ProductDetailViewModel(productId, productRepository, cartRepository)` exposing `uiState: StateFlow<ProductDetailUiState>` and `fun addToCart()` — this is where the "add to cart" RUM action from the spec is tagged, since that's the button's actual location in the UI flow.

- [ ] **Step 1: Write the failing test for `ProductRepository`**

```kotlin
package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.ProductApi
import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.remote.dto.ProductListResponse
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

private fun product(id: String) = ProductDto(
    id = id,
    name = "Ring $id",
    description = "desc",
    price = "19.99",
    stock = 5,
    tags = listOf("cute"),
    imageUrl = null,
    createdAt = "2026-01-01",
)

class ProductRepositoryTest {

    private val api = mockk<ProductApi>()
    private val repository = ProductRepository(api)

    @Test
    fun `getProducts returns the paginated list`() = runTest {
        coEvery { api.getProducts(1, 20) } returns Response.success(
            ProductListResponse(items = listOf(product("p1")), page = 1, limit = 20, total = 1),
        )

        val result = repository.getProducts(1, 20)

        assertTrue(result is ApiResult.Success)
        assertEquals(1, (result as ApiResult.Success).data.items.size)
    }

    @Test
    fun `getProduct returns a single product`() = runTest {
        coEvery { api.getProduct("p1") } returns Response.success(product("p1"))

        val result = repository.getProduct("p1")

        assertTrue(result is ApiResult.Success)
        assertEquals("p1", (result as ApiResult.Success).data.id)
    }
}
```

- [ ] **Step 2: Run test to verify it fails, then implement `ProductRepository`**

Run: expect FAIL (unresolved reference).

```kotlin
package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.ProductApi
import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.remote.dto.ProductListResponse
import com.ringdog.android.data.safeApiCall

class ProductRepository(private val api: ProductApi) {
    suspend fun getProducts(page: Int = 1, limit: Int = 20): ApiResult<ProductListResponse> =
        safeApiCall { api.getProducts(page, limit) }

    suspend fun getProduct(id: String): ApiResult<ProductDto> = safeApiCall { api.getProduct(id) }
}
```

Run again: expect PASS (2 tests).

- [ ] **Step 3: Add `productRepository` to `AppContainer`**

```kotlin
package com.ringdog.android.data

import com.ringdog.android.data.remote.NetworkModule
import com.ringdog.android.data.repository.AuthRepository
import com.ringdog.android.data.repository.CartRepository
import com.ringdog.android.data.repository.ProductRepository

object AppContainer {
    val authRepository: AuthRepository by lazy { AuthRepository(NetworkModule.authApi) }
    val cartRepository: CartRepository by lazy { CartRepository(NetworkModule.cartApi) }
    val productRepository: ProductRepository by lazy { ProductRepository(NetworkModule.productApi) }
}
```

- [ ] **Step 4: Write the failing test for `ProductListViewModel`**

```kotlin
package com.ringdog.android.ui.product

import app.cash.turbine.test
import com.ringdog.android.MainDispatcherRule
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.remote.dto.ProductListResponse
import com.ringdog.android.data.repository.ProductRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class ProductListViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val repository = mockk<ProductRepository>()
    private val product = ProductDto("p1", "Ring", "desc", "19.99", 5, listOf("cute"), null, "2026-01-01")

    @Test
    fun `loads products on init`() = runTest {
        coEvery { repository.getProducts(1, 20) } returns ApiResult.Success(
            ProductListResponse(listOf(product), 1, 20, 1),
        )

        val viewModel = ProductListViewModel(repository)

        viewModel.uiState.test {
            assertEquals(listOf(product), awaitItem().products)
        }
    }

    @Test
    fun `surfaces the error message on failure`() = runTest {
        coEvery { repository.getProducts(1, 20) } returns ApiResult.Error("Network error")

        val viewModel = ProductListViewModel(repository)

        viewModel.uiState.test {
            assertEquals("Network error", awaitItem().errorMessage)
        }
    }
}
```

- [ ] **Step 5: Run test to verify it fails, then implement `ProductListViewModel`**

Run: expect FAIL (unresolved reference).

```kotlin
package com.ringdog.android.ui.product

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.repository.ProductRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProductListUiState(
    val products: List<ProductDto> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

class ProductListViewModel(private val repository: ProductRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(ProductListUiState())
    val uiState: StateFlow<ProductListUiState> = _uiState.asStateFlow()

    init {
        loadProducts()
    }

    fun loadProducts() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.getProducts()) {
                is ApiResult.Success -> _uiState.value = ProductListUiState(products = result.data.items)
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = result.message)
            }
        }
    }
}
```

Run again: expect PASS (2 tests).

- [ ] **Step 6: Write the failing test for `ProductDetailViewModel`, including the RUM add-to-cart tagging**

```kotlin
package com.ringdog.android.ui.product

import app.cash.turbine.test
import com.datadog.android.rum.GlobalRumMonitor
import com.datadog.android.rum.RumActionType
import com.datadog.android.rum.RumMonitor
import com.ringdog.android.MainDispatcherRule
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.CartItemDto
import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.repository.CartRepository
import com.ringdog.android.data.repository.ProductRepository
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import io.mockk.verify
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class ProductDetailViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val productRepository = mockk<ProductRepository>()
    private val cartRepository = mockk<CartRepository>()
    private val product = ProductDto("p1", "Ring", "desc", "19.99", 5, listOf("cute"), null, "2026-01-01")

    @Before
    fun setUp() {
        mockkStatic(GlobalRumMonitor::class)
    }

    @After
    fun tearDown() {
        unmockkStatic(GlobalRumMonitor::class)
    }

    @Test
    fun `loads the product on init`() = runTest {
        coEvery { productRepository.getProduct("p1") } returns ApiResult.Success(product)

        val viewModel = ProductDetailViewModel("p1", productRepository, cartRepository)

        viewModel.uiState.test {
            assertEquals(product, awaitItem().product)
        }
    }

    @Test
    fun `addToCart on success reports a RUM action and flags addedToCart`() = runTest {
        val rumMonitor = mockk<RumMonitor>(relaxed = true)
        every { GlobalRumMonitor.get() } returns rumMonitor
        coEvery { productRepository.getProduct("p1") } returns ApiResult.Success(product)
        val cartItem = CartItemDto("c1", "u1", "p1", 1, "2026-01-01")
        coEvery { cartRepository.addItem("p1", 1) } returns ApiResult.Success(cartItem)

        val viewModel = ProductDetailViewModel("p1", productRepository, cartRepository)
        viewModel.addToCart()
        advanceUntilIdle()

        verify { rumMonitor.addAction(RumActionType.TAP, "add_to_cart", mapOf("product_id" to "p1")) }
        assertEquals(true, viewModel.uiState.value.addedToCart)
    }

    @Test
    fun `addToCart on failure surfaces an error and does not report a RUM action`() = runTest {
        val rumMonitor = mockk<RumMonitor>(relaxed = true)
        every { GlobalRumMonitor.get() } returns rumMonitor
        coEvery { productRepository.getProduct("p1") } returns ApiResult.Success(product)
        coEvery { cartRepository.addItem("p1", 1) } returns ApiResult.Error("Product not found")

        val viewModel = ProductDetailViewModel("p1", productRepository, cartRepository)
        viewModel.addToCart()
        advanceUntilIdle()

        verify(exactly = 0) { rumMonitor.addAction(any(), any(), any()) }
        assertEquals("Product not found", viewModel.uiState.value.errorMessage)
    }
}
```

- [ ] **Step 7: Run test to verify it fails, then implement `ProductDetailViewModel`**

Run: expect FAIL (unresolved reference).

```kotlin
package com.ringdog.android.ui.product

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.datadog.android.rum.GlobalRumMonitor
import com.datadog.android.rum.RumActionType
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.repository.CartRepository
import com.ringdog.android.data.repository.ProductRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProductDetailUiState(
    val product: ProductDto? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val addedToCart: Boolean = false,
)

class ProductDetailViewModel(
    private val productId: String,
    private val productRepository: ProductRepository,
    private val cartRepository: CartRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ProductDetailUiState())
    val uiState: StateFlow<ProductDetailUiState> = _uiState.asStateFlow()

    init {
        loadProduct()
    }

    fun loadProduct() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = productRepository.getProduct(productId)) {
                is ApiResult.Success -> _uiState.value = _uiState.value.copy(product = result.data, isLoading = false)
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = result.message)
            }
        }
    }

    fun addToCart() {
        viewModelScope.launch {
            when (val result = cartRepository.addItem(productId, 1)) {
                is ApiResult.Success -> {
                    GlobalRumMonitor.get().addAction(
                        RumActionType.TAP,
                        "add_to_cart",
                        mapOf("product_id" to productId),
                    )
                    _uiState.value = _uiState.value.copy(addedToCart = true)
                }
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(errorMessage = result.message)
            }
        }
    }
}
```

Run again: expect PASS (3 tests). Note `GlobalRumMonitor.get()` returns a safe no-op monitor when the Datadog SDK hasn't been initialized (which is the case in a plain JVM unit test), so tests that don't stub it (Step 6's first test) still run without crashing — only the tests that need to assert on the RUM call stub it explicitly.

- [ ] **Step 8: Implement `ProductListScreen`**

```kotlin
package com.ringdog.android.ui.product

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ProductListScreen(
    viewModel: ProductListViewModel,
    onProductClick: (String) -> Unit,
    onCartClick: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("RingDog") },
            actions = { Button(onClick = onCartClick) { Text("장바구니") } },
        )

        if (uiState.isLoading) {
            CircularProgressIndicator()
        }

        uiState.errorMessage?.let { Text(it, modifier = Modifier.padding(16.dp)) }

        LazyColumn(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(uiState.products, key = { it.id }) { product ->
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { onProductClick(product.id) },
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(product.name)
                    Text("₩${product.price}")
                }
            }
        }
    }
}
```

- [ ] **Step 9: Implement `ProductDetailScreen`**

```kotlin
package com.ringdog.android.ui.product

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ProductDetailScreen(
    viewModel: ProductDetailViewModel,
    onNavigateToCart: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState.addedToCart) {
        if (uiState.addedToCart) onNavigateToCart()
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (uiState.isLoading) {
            CircularProgressIndicator()
        }

        uiState.errorMessage?.let { Text(it) }

        uiState.product?.let { product ->
            Text(product.name)
            Text(product.description)
            Text("₩${product.price}")
            Text("재고: ${product.stock}")
            Button(onClick = { viewModel.addToCart() }) {
                Text("장바구니에 담기")
            }
        }
    }
}
```

- [ ] **Step 10: Run the full unit test suite and the build**

Run: `./gradlew :app:testLocalDebugUnitTest`
Expected: all tests PASS.

Run: `./gradlew :app:assembleLocalDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 11: Commit**

```bash
git add apps/android-app/app/src/main/java/com/ringdog/android/data/repository/ProductRepository.kt apps/android-app/app/src/main/java/com/ringdog/android/data/AppContainer.kt apps/android-app/app/src/main/java/com/ringdog/android/ui/product apps/android-app/app/src/test/java/com/ringdog/android/data/repository/ProductRepositoryTest.kt apps/android-app/app/src/test/java/com/ringdog/android/ui/product
git commit -m "feat(android): add product repository, view models, screens, and RUM add-to-cart tagging"
```

---

## Task 8: Order feature — repository, view models, screens, RUM place-order tagging

**Files:**
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/data/repository/OrderRepository.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/order/OrderHistoryViewModel.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/order/OrderDetailViewModel.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/order/OrderHistoryScreen.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/order/OrderDetailScreen.kt`
- Modify: `apps/android-app/app/src/main/java/com/ringdog/android/data/AppContainer.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/data/repository/OrderRepositoryTest.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/ui/order/OrderHistoryViewModelTest.kt`
- Test: `apps/android-app/app/src/test/java/com/ringdog/android/ui/order/OrderDetailViewModelTest.kt`

**Interfaces:**
- Consumes: `OrderApi` (Task 3), `AppContainer` (Task 4–7), `MainDispatcherRule` (Task 5), `AppLogger` (Task 2)
- Produces: `OrderRepository(api)` with `suspend fun checkout(couponCode): ApiResult<CheckoutResponse>`, `suspend fun getOrders(): ApiResult<OrderListResponse>`, `suspend fun getOrder(id): ApiResult<OrderDto>`, `suspend fun cancelOrder(id): ApiResult<OrderDto>`. `AppContainer.orderRepository: OrderRepository`. `OrderHistoryViewModel(repository)` exposing `uiState: StateFlow<OrderHistoryUiState>` (including `lastCheckoutOrderId`) and `fun checkout(couponCode)`/`fun loadOrders()` — checkout lives here (not in `CartViewModel`) because placing an order immediately needs to refresh the order list it produces; Task 9's `CartScreen` composition obtains this same `OrderHistoryViewModel` instance to trigger checkout and navigate on `lastCheckoutOrderId`. `OrderDetailViewModel(orderId, repository)` exposing `uiState: StateFlow<OrderDetailUiState>` and `fun cancelOrder()`.

- [ ] **Step 1: Write the failing test for `OrderRepository`**

```kotlin
package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.OrderApi
import com.ringdog.android.data.remote.dto.CheckoutResponse
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.remote.dto.OrderListResponse
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

private fun order(id: String) = OrderDto(
    id = id,
    userId = "u1",
    totalAmount = "19.99",
    couponCode = null,
    status = "PENDING",
    createdAt = "2026-01-01",
    items = emptyList(),
)

class OrderRepositoryTest {

    private val api = mockk<OrderApi>()
    private val repository = OrderRepository(api)

    @Test
    fun `checkout returns the created order id`() = runTest {
        coEvery { api.checkout(any()) } returns Response.success(CheckoutResponse("o1", "PENDING", 19.99))

        val result = repository.checkout()

        assertTrue(result is ApiResult.Success)
        assertEquals("o1", (result as ApiResult.Success).data.orderId)
    }

    @Test
    fun `getOrders returns the order list`() = runTest {
        coEvery { api.getOrders() } returns Response.success(OrderListResponse(listOf(order("o1"))))

        val result = repository.getOrders()

        assertTrue(result is ApiResult.Success)
        assertEquals(1, (result as ApiResult.Success).data.items.size)
    }

    @Test
    fun `cancelOrder returns the updated order`() = runTest {
        coEvery { api.cancelOrder("o1") } returns Response.success(order("o1").copy(status = "CANCELLED"))

        val result = repository.cancelOrder("o1")

        assertTrue(result is ApiResult.Success)
        assertEquals("CANCELLED", (result as ApiResult.Success).data.status)
    }
}
```

- [ ] **Step 2: Run test to verify it fails, then implement `OrderRepository`**

Run: expect FAIL (unresolved reference).

```kotlin
package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.OrderApi
import com.ringdog.android.data.remote.dto.CheckoutRequest
import com.ringdog.android.data.remote.dto.CheckoutResponse
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.remote.dto.OrderListResponse
import com.ringdog.android.data.safeApiCall

class OrderRepository(private val api: OrderApi) {
    suspend fun checkout(couponCode: String? = null): ApiResult<CheckoutResponse> =
        safeApiCall { api.checkout(CheckoutRequest(couponCode)) }

    suspend fun getOrders(): ApiResult<OrderListResponse> = safeApiCall { api.getOrders() }

    suspend fun getOrder(id: String): ApiResult<OrderDto> = safeApiCall { api.getOrder(id) }

    suspend fun cancelOrder(id: String): ApiResult<OrderDto> = safeApiCall { api.cancelOrder(id) }
}
```

Run again: expect PASS (3 tests).

- [ ] **Step 3: Add `orderRepository` to `AppContainer`**

```kotlin
package com.ringdog.android.data

import com.ringdog.android.data.remote.NetworkModule
import com.ringdog.android.data.repository.AuthRepository
import com.ringdog.android.data.repository.CartRepository
import com.ringdog.android.data.repository.OrderRepository
import com.ringdog.android.data.repository.ProductRepository

object AppContainer {
    val authRepository: AuthRepository by lazy { AuthRepository(NetworkModule.authApi) }
    val cartRepository: CartRepository by lazy { CartRepository(NetworkModule.cartApi) }
    val productRepository: ProductRepository by lazy { ProductRepository(NetworkModule.productApi) }
    val orderRepository: OrderRepository by lazy { OrderRepository(NetworkModule.orderApi) }
}
```

- [ ] **Step 4: Write the failing test for `OrderHistoryViewModel`, including the RUM place-order tagging**

```kotlin
package com.ringdog.android.ui.order

import app.cash.turbine.test
import com.datadog.android.rum.GlobalRumMonitor
import com.datadog.android.rum.RumActionType
import com.datadog.android.rum.RumMonitor
import com.ringdog.android.MainDispatcherRule
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.CheckoutResponse
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.remote.dto.OrderListResponse
import com.ringdog.android.data.repository.OrderRepository
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import io.mockk.verify
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test

private fun order(id: String) = OrderDto(id, "u1", "19.99", null, "PENDING", "2026-01-01", emptyList())

class OrderHistoryViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val repository = mockk<OrderRepository>()

    @Before
    fun setUp() {
        mockkStatic(GlobalRumMonitor::class)
    }

    @After
    fun tearDown() {
        unmockkStatic(GlobalRumMonitor::class)
    }

    @Test
    fun `loads orders on init`() = runTest {
        coEvery { repository.getOrders() } returns ApiResult.Success(OrderListResponse(listOf(order("o1"))))

        val viewModel = OrderHistoryViewModel(repository)

        viewModel.uiState.test {
            assertEquals(1, awaitItem().orders.size)
        }
    }

    @Test
    fun `checkout on success reports a RUM action, records the order id, and reloads`() = runTest {
        val rumMonitor = mockk<RumMonitor>(relaxed = true)
        every { GlobalRumMonitor.get() } returns rumMonitor
        coEvery { repository.getOrders() } returnsMany listOf(
            ApiResult.Success(OrderListResponse(emptyList())),
            ApiResult.Success(OrderListResponse(listOf(order("o1")))),
        )
        coEvery { repository.checkout(null) } returns ApiResult.Success(CheckoutResponse("o1", "PENDING", 19.99))

        val viewModel = OrderHistoryViewModel(repository)
        viewModel.checkout()
        advanceUntilIdle()

        verify {
            rumMonitor.addAction(
                RumActionType.CUSTOM,
                "place_order",
                mapOf("order_id" to "o1", "total_amount" to 19.99),
            )
        }
        assertEquals("o1", viewModel.uiState.value.lastCheckoutOrderId)
        assertEquals(1, viewModel.uiState.value.orders.size)
    }

    @Test
    fun `checkout on failure surfaces an error and does not report a RUM action`() = runTest {
        val rumMonitor = mockk<RumMonitor>(relaxed = true)
        every { GlobalRumMonitor.get() } returns rumMonitor
        coEvery { repository.getOrders() } returns ApiResult.Success(OrderListResponse(emptyList()))
        coEvery { repository.checkout(null) } returns ApiResult.Error("Cart is empty")

        val viewModel = OrderHistoryViewModel(repository)
        viewModel.checkout()
        advanceUntilIdle()

        verify(exactly = 0) { rumMonitor.addAction(any(), any(), any()) }
        assertEquals("Cart is empty", viewModel.uiState.value.errorMessage)
    }
}
```

- [ ] **Step 5: Run test to verify it fails, then implement `OrderHistoryViewModel`**

Run: expect FAIL (unresolved reference).

```kotlin
package com.ringdog.android.ui.order

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.datadog.android.rum.GlobalRumMonitor
import com.datadog.android.rum.RumActionType
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.repository.OrderRepository
import com.ringdog.android.datadog.AppLogger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class OrderHistoryUiState(
    val orders: List<OrderDto> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val lastCheckoutOrderId: String? = null,
)

class OrderHistoryViewModel(private val repository: OrderRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(OrderHistoryUiState())
    val uiState: StateFlow<OrderHistoryUiState> = _uiState.asStateFlow()

    init {
        loadOrders()
    }

    fun loadOrders() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.getOrders()) {
                is ApiResult.Success -> _uiState.value = _uiState.value.copy(orders = result.data.items, isLoading = false)
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = result.message)
            }
        }
    }

    fun checkout(couponCode: String? = null) {
        viewModelScope.launch {
            when (val result = repository.checkout(couponCode)) {
                is ApiResult.Success -> {
                    GlobalRumMonitor.get().addAction(
                        RumActionType.CUSTOM,
                        "place_order",
                        mapOf("order_id" to result.data.orderId, "total_amount" to result.data.totalAmount),
                    )
                    _uiState.value = _uiState.value.copy(lastCheckoutOrderId = result.data.orderId)
                    loadOrders()
                }
                is ApiResult.Error -> {
                    AppLogger.error("order_failure", mapOf("reason" to result.message, "coupon_code" to couponCode))
                    _uiState.value = _uiState.value.copy(errorMessage = result.message)
                }
            }
        }
    }
}
```

Run again: expect PASS (3 tests) — same reasoning as Task 5's `AppLogger` calls: safe no-op without SDK init, so the existing assertions on `rumMonitor`/`uiState` are unaffected.

- [ ] **Step 6: Write the failing test for `OrderDetailViewModel`**

```kotlin
package com.ringdog.android.ui.order

import app.cash.turbine.test
import com.ringdog.android.MainDispatcherRule
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.repository.OrderRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

private fun order(status: String) = OrderDto("o1", "u1", "19.99", null, status, "2026-01-01", emptyList())

class OrderDetailViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val repository = mockk<OrderRepository>()

    @Test
    fun `loads the order on init`() = runTest {
        coEvery { repository.getOrder("o1") } returns ApiResult.Success(order("PENDING"))

        val viewModel = OrderDetailViewModel("o1", repository)

        viewModel.uiState.test {
            assertEquals("PENDING", awaitItem().order?.status)
        }
    }

    @Test
    fun `cancelOrder updates the order with the cancelled status`() = runTest {
        coEvery { repository.getOrder("o1") } returns ApiResult.Success(order("PENDING"))
        coEvery { repository.cancelOrder("o1") } returns ApiResult.Success(order("CANCELLED"))
        val viewModel = OrderDetailViewModel("o1", repository)

        viewModel.uiState.test {
            assertEquals("PENDING", awaitItem().order?.status)
            viewModel.cancelOrder()
            assertEquals("CANCELLED", awaitItem().order?.status)
        }
    }
}
```

- [ ] **Step 7: Run test to verify it fails, then implement `OrderDetailViewModel`**

Run: expect FAIL (unresolved reference).

```kotlin
package com.ringdog.android.ui.order

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.repository.OrderRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class OrderDetailUiState(
    val order: OrderDto? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

class OrderDetailViewModel(
    private val orderId: String,
    private val repository: OrderRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(OrderDetailUiState())
    val uiState: StateFlow<OrderDetailUiState> = _uiState.asStateFlow()

    init {
        loadOrder()
    }

    fun loadOrder() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.getOrder(orderId)) {
                is ApiResult.Success -> _uiState.value = _uiState.value.copy(order = result.data, isLoading = false)
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = result.message)
            }
        }
    }

    fun cancelOrder() {
        viewModelScope.launch {
            when (val result = repository.cancelOrder(orderId)) {
                is ApiResult.Success -> _uiState.value = _uiState.value.copy(order = result.data)
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(errorMessage = result.message)
            }
        }
    }
}
```

Run again: expect PASS (2 tests).

- [ ] **Step 8: Implement `OrderHistoryScreen`**

```kotlin
package com.ringdog.android.ui.order

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun OrderHistoryScreen(
    viewModel: OrderHistoryViewModel,
    onOrderClick: (String) -> Unit,
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("주문 내역")

        if (uiState.isLoading) {
            CircularProgressIndicator()
        }

        uiState.errorMessage?.let { Text(it) }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(uiState.orders, key = { it.id }) { order ->
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { onOrderClick(order.id) },
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text("주문 #${order.id.take(8)}")
                    Text("${order.status} · ₩${order.totalAmount}")
                }
            }
        }
    }
}
```

- [ ] **Step 9: Implement `OrderDetailScreen`**

```kotlin
package com.ringdog.android.ui.order

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun OrderDetailScreen(viewModel: OrderDetailViewModel) {
    val uiState by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (uiState.isLoading) {
            CircularProgressIndicator()
        }

        uiState.errorMessage?.let { Text(it) }

        uiState.order?.let { order ->
            Text("주문 #${order.id}")
            Text("상태: ${order.status}")
            Text("총액: ₩${order.totalAmount}")
            order.items.forEach { item ->
                Text("- ${item.product.name} x${item.quantity} (₩${item.unitPrice})")
            }
            if (order.status == "PENDING" || order.status == "PAID") {
                Button(onClick = { viewModel.cancelOrder() }) {
                    Text("주문 취소")
                }
            }
        }
    }
}
```

- [ ] **Step 10: Run the full unit test suite and the build**

Run: `./gradlew :app:testLocalDebugUnitTest`
Expected: all tests PASS.

Run: `./gradlew :app:assembleLocalDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 11: Commit**

```bash
git add apps/android-app/app/src/main/java/com/ringdog/android/data/repository/OrderRepository.kt apps/android-app/app/src/main/java/com/ringdog/android/data/AppContainer.kt apps/android-app/app/src/main/java/com/ringdog/android/ui/order apps/android-app/app/src/test/java/com/ringdog/android/data/repository/OrderRepositoryTest.kt apps/android-app/app/src/test/java/com/ringdog/android/ui/order
git commit -m "feat(android): add order repository, view models, screens, and RUM place-order tagging"
```

---

## Task 9: Navigation graph, RUM view tracking, session-expiry handling

**Files:**
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/navigation/Routes.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/navigation/RingDogNavHost.kt`
- Create: `apps/android-app/app/src/main/java/com/ringdog/android/ui/cart/CartCheckoutSection.kt`
- Modify: `apps/android-app/app/src/main/java/com/ringdog/android/MainActivity.kt`

**Interfaces:**
- Consumes: every screen/ViewModel from Tasks 5–8, `AppContainer`, `TokenStore.isLoggedIn()` (Task 4), `AuthEventBus.sessionExpired` (Task 4)
- Produces: a fully wired, runnable app. Nothing downstream consumes this — it's the top of the dependency graph.

This task has no new pure logic to unit test (it's wiring). Its correctness is verified by a manual end-to-end run, which is the acceptance test for the whole plan.

- [ ] **Step 1: Create `Routes`**

```kotlin
package com.ringdog.android.ui.navigation

object Routes {
    const val LOGIN = "login"
    const val SIGNUP = "signup"
    const val PRODUCT_LIST = "products"
    const val PRODUCT_DETAIL = "products/{productId}"
    const val CART = "cart"
    const val ORDER_HISTORY = "orders"
    const val ORDER_DETAIL = "orders/{orderId}"

    fun productDetail(productId: String) = "products/$productId"
    fun orderDetail(orderId: String) = "orders/$orderId"
}
```

- [ ] **Step 2: Create a small composable that hosts the cart's checkout button, sharing the `OrderHistoryViewModel` used for checkout**

```kotlin
package com.ringdog.android.ui.cart

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ringdog.android.ui.order.OrderHistoryViewModel

@Composable
fun CartCheckoutSection(
    orderViewModel: OrderHistoryViewModel,
    onCheckoutSuccess: (orderId: String) -> Unit,
) {
    val orderUiState by orderViewModel.uiState.collectAsState()

    LaunchedEffect(orderUiState.lastCheckoutOrderId) {
        orderUiState.lastCheckoutOrderId?.let(onCheckoutSuccess)
    }

    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        orderUiState.errorMessage?.let { Text(it) }
        Button(
            onClick = { orderViewModel.checkout() },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("주문하기")
        }
    }
}
```

`CartCheckoutSection` only needs the `OrderHistoryViewModel` (checkout lives there, per this task's Interfaces note) — it does not take a `CartViewModel` parameter since it never reads cart state directly.

- [ ] **Step 3: Create `RingDogNavHost`**

```kotlin
package com.ringdog.android.ui.navigation

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.ringdog.android.data.AppContainer
import com.ringdog.android.data.local.TokenStore
import com.ringdog.android.data.remote.AuthEventBus
import com.ringdog.android.ui.auth.AuthViewModel
import com.ringdog.android.ui.auth.LoginScreen
import com.ringdog.android.ui.auth.SignupScreen
import com.ringdog.android.ui.cart.CartCheckoutSection
import com.ringdog.android.ui.cart.CartScreen
import com.ringdog.android.ui.cart.CartViewModel
import com.ringdog.android.ui.order.OrderDetailScreen
import com.ringdog.android.ui.order.OrderDetailViewModel
import com.ringdog.android.ui.order.OrderHistoryScreen
import com.ringdog.android.ui.order.OrderHistoryViewModel
import com.ringdog.android.ui.product.ProductDetailScreen
import com.ringdog.android.ui.product.ProductDetailViewModel
import com.ringdog.android.ui.product.ProductListScreen
import com.ringdog.android.ui.product.ProductListViewModel

@Composable
fun RingDogNavHost(navController: NavHostController) {
    val startDestination = if (TokenStore.isLoggedIn()) Routes.PRODUCT_LIST else Routes.LOGIN

    LaunchedEffect(Unit) {
        AuthEventBus.sessionExpired.collect {
            navController.navigate(Routes.LOGIN) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable(Routes.LOGIN) {
            val viewModel = viewModel { AuthViewModel(AppContainer.authRepository) }
            LoginScreen(
                viewModel = viewModel,
                onLoginSuccess = {
                    navController.navigate(Routes.PRODUCT_LIST) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onNavigateToSignup = { navController.navigate(Routes.SIGNUP) },
            )
        }

        composable(Routes.SIGNUP) {
            val viewModel = viewModel { AuthViewModel(AppContainer.authRepository) }
            SignupScreen(
                viewModel = viewModel,
                onSignupSuccess = { navController.popBackStack() },
                onNavigateToLogin = { navController.popBackStack() },
            )
        }

        composable(Routes.PRODUCT_LIST) {
            val viewModel = viewModel { ProductListViewModel(AppContainer.productRepository) }
            ProductListScreen(
                viewModel = viewModel,
                onProductClick = { productId -> navController.navigate(Routes.productDetail(productId)) },
                onCartClick = { navController.navigate(Routes.CART) },
            )
        }

        composable(
            route = Routes.PRODUCT_DETAIL,
            arguments = listOf(navArgument("productId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val productId = requireNotNull(backStackEntry.arguments?.getString("productId"))
            val viewModel = viewModel {
                ProductDetailViewModel(productId, AppContainer.productRepository, AppContainer.cartRepository)
            }
            ProductDetailScreen(viewModel = viewModel, onNavigateToCart = { navController.navigate(Routes.CART) })
        }

        composable(Routes.CART) {
            val cartViewModel = viewModel { CartViewModel(AppContainer.cartRepository) }
            val orderViewModel = viewModel { OrderHistoryViewModel(AppContainer.orderRepository) }
            Column {
                CartScreen(viewModel = cartViewModel)
                CartCheckoutSection(
                    orderViewModel = orderViewModel,
                    onCheckoutSuccess = { orderId ->
                        navController.navigate(Routes.orderDetail(orderId)) {
                            popUpTo(Routes.PRODUCT_LIST)
                        }
                    },
                )
            }
        }

        composable(Routes.ORDER_HISTORY) {
            val viewModel = viewModel { OrderHistoryViewModel(AppContainer.orderRepository) }
            OrderHistoryScreen(
                viewModel = viewModel,
                onOrderClick = { orderId -> navController.navigate(Routes.orderDetail(orderId)) },
            )
        }

        composable(
            route = Routes.ORDER_DETAIL,
            arguments = listOf(navArgument("orderId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val orderId = requireNotNull(backStackEntry.arguments?.getString("orderId"))
            val viewModel = viewModel { OrderDetailViewModel(orderId, AppContainer.orderRepository) }
            OrderDetailScreen(viewModel = viewModel)
        }
    }
}
```

- [ ] **Step 4: Wire `RingDogNavHost` and RUM navigation tracking into `MainActivity`**

```kotlin
package com.ringdog.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.datadog.android.rum.tracking.NavigationViewTrackingStrategy
import com.ringdog.android.ui.navigation.RingDogNavHost
import com.ringdog.android.ui.theme.RingDogTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            RingDogTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    val navController = rememberNavController()
                    DisposableEffect(navController) {
                        val trackingStrategy = NavigationViewTrackingStrategy(trackArguments = false)
                        trackingStrategy.register(this@MainActivity, navController)
                        onDispose { trackingStrategy.unregister(navController) }
                    }
                    RingDogNavHost(navController = navController)
                }
            }
        }
    }
}
```

- [ ] **Step 5: Run the full unit test suite and the build**

Run: `./gradlew :app:testLocalDebugUnitTest`
Expected: all tests from Tasks 2–8 still PASS (this task added no new unit tests).

Run: `./gradlew :app:assembleLocalDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Manual end-to-end verification (this is the acceptance test for the whole plan)**

Prerequisites: `backend-api` running locally (per the existing local-dev setup — see `docs/local-setup-progress.md`/`env_local_dev_setup` notes) and reachable at the port baked into the `local` flavor's `BASE_URL`; a real Datadog Android RUM application's credentials filled into `local.properties`.

1. Run: `./gradlew :app:installLocalDebug` with an emulator running (or a USB-connected device with debugging enabled), then launch the app.
2. Sign up with a new email/password → should land on the product list.
3. Force-quit and relaunch the app → should skip straight to the product list (token persisted).
4. Tap a product → see detail → tap "장바구니에 담기" → should navigate to the cart with the item present.
5. Tap "주문하기" on the cart → should navigate to the newly created order's detail screen, status `PENDING`.
6. Navigate to order history → the new order should be listed.
7. Cancel the order from its detail screen → status should update to `CANCELLED`.
8. In the Datadog web UI (RUM → Application → this Android app), confirm: a RUM session appears, view names match the screens visited, `add_to_cart`/`place_order` custom actions appear, and at least one network resource span shows a connected APM trace continuing into `backend-api`'s spans (confirms the `DatadogInterceptor` distributed-tracing link is real, not just configured).
9. To verify session-expiry handling: manually expire the token (e.g., restart `backend-api` with a different `JWT_SECRET`, or wait out `JWT_EXPIRES_IN`) and trigger any authenticated request (e.g., pull-to-refresh the product list) → the app should bounce back to the login screen.

- [ ] **Step 7: Commit**

```bash
git add apps/android-app/app/src/main/java/com/ringdog/android/ui/navigation apps/android-app/app/src/main/java/com/ringdog/android/ui/cart/CartCheckoutSection.kt apps/android-app/app/src/main/java/com/ringdog/android/MainActivity.kt
git commit -m "feat(android): wire navigation graph, RUM view tracking, and session-expiry redirect"
```

---

## Task 10: Documentation — credentials setup and app README

**Files:**
- Modify: `docs/credentials-setup.md` (local-only, gitignored — see note below)
- Create: `apps/android-app/README.md`

**Interfaces:**
- Consumes: nothing code-level; documents the conventions established in Tasks 1 and 4.
- Produces: nothing consumed by other tasks — this is the terminal task.

`docs/credentials-setup.md` is gitignored (confirmed present locally but intentionally untracked, per this repo's established pattern of keeping account IDs/ARNs out of git — see the file's own existing content). Edit it locally; do not expect `git add` to pick it up, and do not force-add a gitignored file.

- [ ] **Step 1: Add an Android section to `docs/credentials-setup.md`**

Read the file first to match its existing Korean tone and table style, then add a new `## 5. Android 앱 (apps/android-app)` section before the "요약" table, covering:

```markdown
## 5. Android 앱 (`apps/android-app`)

웹 프론트엔드와 별도로, Datadog RUM → Manage Applications에서 **Android 타입**
RUM 애플리케이션을 새로 생성해야 함 (기존 `ringdog-frontend`용 웹 애플리케이션과는
다른 Application ID/Client Token이 발급됨).

**로컬 개발**

`apps/android-app/local.properties.example`을 `apps/android-app/local.properties`로
복사(이미 gitignore 대상)한 뒤 값 채우기:

| 키 | 값 출처 |
|---|---|
| `DD_RUM_APPLICATION_ID` | 새로 만든 Android RUM 애플리케이션의 Application ID |
| `DD_RUM_CLIENT_TOKEN` | 같은 애플리케이션의 Client Token |

**데모 빌드 (`demo` flavor)**

CI가 없으므로 데모 직전에 수동으로 아래처럼 빌드:

```bash
./gradlew :app:assembleDemoRelease \
  -PDEMO_BASE_URL=$(kubectl get ingress ringdog -n ringdog -o jsonpath='{.status.loadBalancer.ingress[0].hostname}') \
  -PDD_RUM_APPLICATION_ID_ANDROID=<Android RUM Application ID> \
  -PDD_RUM_CLIENT_TOKEN_ANDROID=<Android RUM Client Token>
```

`DEMO_BASE_URL`은 ALB 호스트명이라 `terraform apply`/재배포 때마다 바뀜 — 매번 다시
조회해서 넘겨야 함(웹 프론트엔드의 `cd.yml`이 하는 것과 동일한 이유). GitHub
Secrets로 등록해둘 필요는 없음(CI가 이 값을 쓰지 않으므로) — 다만 반복 조회를
편하게 하려면 Datadog Application ID/Client Token 두 값만 개인 메모에 저장해둬도
됨(계정 자격증명이 아니라 프론트엔드처럼 클라이언트 사이드 공개용 값이라 민감도 낮음).
```

- [ ] **Step 2: Create `apps/android-app/README.md`**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/android-app/README.md
git commit -m "docs(android): add app README and credentials-setup instructions"
```

(`docs/credentials-setup.md` is gitignored — its edit from Step 1 stays local-only and is not part of this commit.)
