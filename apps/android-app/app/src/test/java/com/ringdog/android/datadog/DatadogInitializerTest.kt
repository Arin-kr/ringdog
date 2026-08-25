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
