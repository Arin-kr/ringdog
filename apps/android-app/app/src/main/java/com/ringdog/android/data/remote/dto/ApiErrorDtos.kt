package com.ringdog.android.data.remote.dto

data class ApiErrorResponse(val error: ApiErrorDetail)

data class ApiErrorDetail(val message: String)
