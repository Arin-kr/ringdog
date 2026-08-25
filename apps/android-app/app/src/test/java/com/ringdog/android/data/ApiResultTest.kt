package com.ringdog.android.data

import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response
import java.io.IOException

data class TestPayload(val value: String)

class ApiResultTest {

    @Test
    fun `returns Success when the call succeeds with a body`() = runTest {
        val result = safeApiCall { Response.success(TestPayload("hello")) }
        assertEquals(ApiResult.Success(TestPayload("hello")), result)
    }

    @Test
    fun `returns Error with the parsed backend message when the call fails`() = runTest {
        val errorJson = """{"error":{"message":"Product not found"}}"""
        val errorBody = errorJson.toResponseBody("application/json".toMediaType())
        val result = safeApiCall { Response.error<TestPayload>(404, errorBody) }
        assertTrue(result is ApiResult.Error)
        assertEquals("Product not found", (result as ApiResult.Error).message)
        assertEquals(404, result.code)
    }

    @Test
    fun `returns Error with a fallback message when the error body is not the expected shape`() = runTest {
        val errorBody = "not json".toResponseBody("text/plain".toMediaType())
        val result = safeApiCall { Response.error<TestPayload>(500, errorBody) } as ApiResult.Error
        assertEquals("Request failed with code 500", result.message)
    }

    @Test
    fun `returns Error when the call throws IOException`() = runTest {
        val result = safeApiCall<TestPayload> { throw IOException("no network") }
        assertTrue(result is ApiResult.Error)
        assertEquals("no network", (result as ApiResult.Error).message)
    }

    @Test
    fun `treats a successful null body as Success of Unit for no-content responses`() = runTest {
        val result = safeApiCall { Response.success<Unit>(null) }
        assertEquals(ApiResult.Success(Unit), result)
    }
}
