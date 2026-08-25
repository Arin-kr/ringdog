package com.ringdog.android

import android.app.Application
import com.ringdog.android.datadog.DatadogInitializer

class RingDogApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        DatadogInitializer.initialize(this)
    }
}
