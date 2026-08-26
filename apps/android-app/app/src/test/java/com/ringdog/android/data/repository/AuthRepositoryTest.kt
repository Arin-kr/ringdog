package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.AuthApi
import com.ringdog.android.data.remote.dto.LoginResponse
import com.ringdog.android.data.remote.dto.SignupResponse
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

class AuthRepositoryTest {

    private val api = mockk<AuthApi>()

    @Test
    fun `login success stores the received token`() = runTest {
        var savedToken: String? = null
        val repository = AuthRepository(api, onTokenReceived = { savedToken = it })
        coEvery { api.login(any()) } returns Response.success(LoginResponse("jwt-123", "1h"))

        val result = repository.login("a@b.com", "password123")

        assertTrue(result is ApiResult.Success)
        assertEquals("jwt-123", savedToken)
    }

    @Test
    fun `login failure does not store a token`() = runTest {
        var savedToken: String? = null
        val repository = AuthRepository(api, onTokenReceived = { savedToken = it })
        val errorBody = """{"error":{"message":"Invalid email or password"}}"""
            .toResponseBody("application/json".toMediaType())
        coEvery { api.login(any()) } returns Response.error(401, errorBody)

        val result = repository.login("a@b.com", "wrong")

        assertTrue(result is ApiResult.Error)
        assertNull(savedToken)
    }

    @Test
    fun `signup delegates to the API without touching the token`() = runTest {
        var tokenTouched = false
        val repository = AuthRepository(api, onTokenReceived = { tokenTouched = true })
        coEvery { api.signup(any()) } returns Response.success(SignupResponse("u1", "a@b.com", "customer", "2026-01-01"))

        val result = repository.signup("a@b.com", "password123")

        assertTrue(result is ApiResult.Success)
        assertEquals(false, tokenTouched)
    }

    @Test
    fun `logout invokes the onLogout callback`() {
        var loggedOut = false
        val repository = AuthRepository(api, onLogout = { loggedOut = true })

        repository.logout()

        assertTrue(loggedOut)
    }
}
