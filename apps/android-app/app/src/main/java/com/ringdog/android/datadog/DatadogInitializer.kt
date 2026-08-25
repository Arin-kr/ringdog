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
