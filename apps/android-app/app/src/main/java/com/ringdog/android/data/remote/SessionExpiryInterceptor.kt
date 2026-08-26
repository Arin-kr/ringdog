package com.ringdog.android.data.remote

import okhttp3.Interceptor
import okhttp3.Response

class SessionExpiryInterceptor(private val onSessionExpired: () -> Unit) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        if (response.code == 401) {
            onSessionExpired()
        }
        return response
    }
}
