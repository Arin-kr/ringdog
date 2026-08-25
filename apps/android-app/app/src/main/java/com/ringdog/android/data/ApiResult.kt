package com.ringdog.android.data

import com.google.gson.Gson
import com.ringdog.android.data.remote.dto.ApiErrorResponse
import retrofit2.Response
import java.io.IOException

sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val message: String, val code: Int? = null) : ApiResult<Nothing>()
}

suspend fun <T> safeApiCall(call: suspend () -> Response<T>): ApiResult<T> {
    return try {
        val response = call()
        if (response.isSuccessful) {
            // DELETE endpoints return 204 with a null body; safe to coerce to
            // Unit since callers of a Response<Unit> endpoint expect exactly that.
            @Suppress("UNCHECKED_CAST")
            ApiResult.Success((response.body() ?: Unit) as T)
        } else {
            val message = response.errorBody()?.string()?.let { raw ->
                runCatching { Gson().fromJson(raw, ApiErrorResponse::class.java).error.message }.getOrNull()
            } ?: "Request failed with code ${response.code()}"
            ApiResult.Error(message, response.code())
        }
    } catch (e: IOException) {
        ApiResult.Error(e.message ?: "Network error")
    }
}
