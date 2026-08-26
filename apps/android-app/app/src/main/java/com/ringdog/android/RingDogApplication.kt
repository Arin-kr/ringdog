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
