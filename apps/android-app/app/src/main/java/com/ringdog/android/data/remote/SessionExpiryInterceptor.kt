package com.ringdog.android.data.remote

import okhttp3.Interceptor
import okhttp3.Response

class SessionExpiryInterceptor(private val onSessionExpired: () -> Unit) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val response = chain.proceed(request)
        // Only an authenticated request's token being rejected means the session expired.
        // A 401 on a request with no Authorization header (e.g. bad login credentials) is
        // not a session expiry and must not trigger the same "please sign in again" event.
        if (response.code == 401 && request.header("Authorization") != null) {
            onSessionExpired()
        }
        return response
    }
}
