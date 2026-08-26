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
    fun `invokes callback exactly once on a 401 response to a request with an Authorization header`() {
        server.enqueue(MockResponse().setResponseCode(401))
        val callCount = AtomicInteger(0)
        val client = OkHttpClient.Builder()
            .addInterceptor(SessionExpiryInterceptor { callCount.incrementAndGet() })
            .build()

        client.newCall(
            Request.Builder().url(server.url("/secure")).addHeader("Authorization", "Bearer jwt-123").build(),
        ).execute()

        assertEquals(1, callCount.get())
    }

    @Test
    fun `does not invoke callback on a 401 response to a request without an Authorization header`() {
        server.enqueue(MockResponse().setResponseCode(401))
        val callCount = AtomicInteger(0)
        val client = OkHttpClient.Builder()
            .addInterceptor(SessionExpiryInterceptor { callCount.incrementAndGet() })
            .build()

        client.newCall(Request.Builder().url(server.url("/login")).build()).execute()

        assertEquals(0, callCount.get())
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
