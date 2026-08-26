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
