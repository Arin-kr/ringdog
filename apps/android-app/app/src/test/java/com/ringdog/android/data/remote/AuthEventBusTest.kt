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
