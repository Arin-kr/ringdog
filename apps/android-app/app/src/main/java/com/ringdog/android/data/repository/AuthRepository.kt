package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.local.TokenStore
import com.ringdog.android.data.remote.api.AuthApi
import com.ringdog.android.data.remote.dto.LoginRequest
import com.ringdog.android.data.remote.dto.LoginResponse
import com.ringdog.android.data.remote.dto.SignupRequest
import com.ringdog.android.data.remote.dto.SignupResponse
import com.ringdog.android.data.safeApiCall

class AuthRepository(
    private val api: AuthApi,
    private val onTokenReceived: (String) -> Unit = TokenStore::saveToken,
    private val onLogout: () -> Unit = TokenStore::clearToken,
) {
    suspend fun signup(email: String, password: String): ApiResult<SignupResponse> =
        safeApiCall { api.signup(SignupRequest(email, password)) }

    suspend fun login(email: String, password: String): ApiResult<LoginResponse> {
        val result = safeApiCall { api.login(LoginRequest(email, password)) }
        if (result is ApiResult.Success) {
            onTokenReceived(result.data.token)
        }
        return result
    }

    fun logout() = onLogout()
}
