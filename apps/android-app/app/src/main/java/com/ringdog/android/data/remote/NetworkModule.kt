package com.ringdog.android.data.remote

import com.datadog.android.okhttp.DatadogInterceptor
import com.datadog.android.trace.TracingHeaderType
import com.google.gson.Gson
import com.ringdog.android.BuildConfig
import com.ringdog.android.data.local.TokenStore
import com.ringdog.android.data.remote.api.AuthApi
import com.ringdog.android.data.remote.api.CartApi
import com.ringdog.android.data.remote.api.OrderApi
import com.ringdog.android.data.remote.api.ProductApi
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object NetworkModule {

    private val tracedHost: String = BuildConfig.BASE_URL.toHttpUrl().host

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
    }

    // Restricting tracedHosts to backend-api's own host ensures Datadog distributed-trace
    // headers are only attached to requests we control, never leaked to a third-party host.
    private val datadogInterceptor: DatadogInterceptor by lazy {
        DatadogInterceptor.Builder(mapOf(tracedHost to setOf(TracingHeaderType.DATADOG))).build()
    }

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor { TokenStore.getToken() })
            .addInterceptor(datadogInterceptor)
            .addInterceptor(SessionExpiryInterceptor { AuthEventBus.notifySessionExpired() })
            .addInterceptor(loggingInterceptor)
            .build()
    }

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BuildConfig.BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(Gson()))
            .build()
    }

    val authApi: AuthApi by lazy { retrofit.create(AuthApi::class.java) }
    val productApi: ProductApi by lazy { retrofit.create(ProductApi::class.java) }
    val cartApi: CartApi by lazy { retrofit.create(CartApi::class.java) }
    val orderApi: OrderApi by lazy { retrofit.create(OrderApi::class.java) }
}
