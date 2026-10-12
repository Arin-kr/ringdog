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
import com.datadog.android.sessionreplay.SessionReplay
import com.datadog.android.sessionreplay.SessionReplayConfiguration
import com.datadog.android.sessionreplay.TextAndInputPrivacy
import com.datadog.android.sessionreplay.compose.ComposeExtensionSupport
import com.datadog.android.trace.Trace
import com.datadog.android.trace.TraceConfiguration
import com.ringdog.android.BuildConfig

object DatadogInitializer {

    fun resolveEnvironmentName(flavor: String): String = if (flavor == "demo") "demo" else "local"

    fun initialize(application: Application) {
        // local.properties may override env (e.g. `rum.environmentName`); otherwise derive from flavor.
        val environmentName = BuildConfig.DD_ENV.ifBlank { resolveEnvironmentName(BuildConfig.FLAVOR) }

        val configuration = Configuration.Builder(
            clientToken = BuildConfig.DD_RUM_CLIENT_TOKEN,
            env = environmentName,
            variant = BuildConfig.FLAVOR,
        ).useSite(DatadogSite.US1)
            .apply {
                if (BuildConfig.DD_REMOTE_CONFIG_ID.isNotBlank()) {
                    setRemoteConfigurationId(BuildConfig.DD_REMOTE_CONFIG_ID)
                }
            }
            .build()

        Datadog.initialize(application, configuration, TrackingConsent.GRANTED)

        val rumConfiguration = RumConfiguration.Builder(BuildConfig.DD_RUM_APPLICATION_ID)
            .trackUserInteractions()
            .trackLongTasks()
            .build()
        Rum.enable(rumConfiguration)

        // Must come after Rum.enable: replays attach to RUM sessions/views. The whole UI is
        // Jetpack Compose, so ComposeExtensionSupport is what lets screens actually be captured.
        // Demo data only, so text stays visible; passwords and other sensitive inputs are masked.
        val sessionReplayConfiguration = SessionReplayConfiguration.Builder(100f)
            .addExtensionSupport(ComposeExtensionSupport())
            .setTextAndInputPrivacy(TextAndInputPrivacy.MASK_SENSITIVE_INPUTS)
            .build()
        SessionReplay.enable(sessionReplayConfiguration)

        Trace.enable(TraceConfiguration.Builder().build())
        Logs.enable(LogsConfiguration.Builder().build())
    }
}
