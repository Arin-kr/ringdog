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
