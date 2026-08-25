package com.ringdog.android.data.remote.dto

import com.google.gson.annotations.SerializedName

data class SignupRequest(val email: String, val password: String)

data class SignupResponse(
    val id: String,
    val email: String,
    val role: String,
    @SerializedName("created_at") val createdAt: String,
)

data class LoginRequest(val email: String, val password: String)

data class LoginResponse(
    val token: String,
    @SerializedName("expires_in") val expiresIn: String,
)
