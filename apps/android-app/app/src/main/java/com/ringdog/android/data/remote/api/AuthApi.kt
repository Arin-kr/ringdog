package com.ringdog.android.data.remote.api

import com.ringdog.android.data.remote.dto.LoginRequest
import com.ringdog.android.data.remote.dto.LoginResponse
import com.ringdog.android.data.remote.dto.SignupRequest
import com.ringdog.android.data.remote.dto.SignupResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApi {
    @POST("api/auth/signup")
    suspend fun signup(@Body request: SignupRequest): Response<SignupResponse>

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>
}
