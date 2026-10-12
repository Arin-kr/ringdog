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

// First non-blank local.properties value among `keys`. Accepts both this repo's
// DD_RUM_* names and the `rum.*` names from Datadog's onboarding snippet, strips
// surrounding quotes (.properties keeps them literally), and skips unfilled
// `<PLACEHOLDER>` values copied verbatim from that snippet.
fun localRumProperty(vararg keys: String): String =
    keys.asSequence()
        .map { localProperties.getProperty(it, "").trim().removeSurrounding("\"") }
        .firstOrNull { it.isNotBlank() && !(it.startsWith("<") && it.endsWith(">")) }
        ?: ""

android {
    namespace = "com.ringdog.android"
    compileSdk = 35

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
                "\"${localRumProperty("DD_RUM_APPLICATION_ID", "rum.applicationId")}\"",
            )
            buildConfigField(
                "String",
                "DD_RUM_CLIENT_TOKEN",
                "\"${localRumProperty("DD_RUM_CLIENT_TOKEN", "rum.clientToken")}\"",
            )
            buildConfigField("String", "DD_ENV", "\"${localRumProperty("DD_ENV", "rum.environmentName")}\"")
            buildConfigField(
                "String",
                "DD_REMOTE_CONFIG_ID",
                "\"${localRumProperty("DD_REMOTE_CONFIG_ID", "rum.remoteConfigId")}\"",
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
            buildConfigField("String", "DD_ENV", "\"\"")
            buildConfigField("String", "DD_REMOTE_CONFIG_ID", "\"\"")
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

    implementation("com.datadoghq:dd-sdk-android-rum:3.15.0")
    implementation("com.datadoghq:dd-sdk-android-trace:3.15.0")
    implementation("com.datadoghq:dd-sdk-android-logs:3.15.0")
    implementation("com.datadoghq:dd-sdk-android-okhttp:3.15.0")
    implementation("com.datadoghq:dd-sdk-android-session-replay:3.15.0")
    implementation("com.datadoghq:dd-sdk-android-session-replay-compose:3.15.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("io.mockk:mockk:1.13.11")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    testImplementation("app.cash.turbine:turbine:1.1.0")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
