package com.ringdog.android.data.remote.api

import com.ringdog.android.data.remote.dto.CheckoutRequest
import com.ringdog.android.data.remote.dto.CheckoutResponse
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.remote.dto.OrderListResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

interface OrderApi {
    @POST("api/orders/checkout")
    suspend fun checkout(@Body request: CheckoutRequest): Response<CheckoutResponse>

    @GET("api/orders")
    suspend fun getOrders(): Response<OrderListResponse>

    @GET("api/orders/{id}")
    suspend fun getOrder(@Path("id") id: String): Response<OrderDto>

    @PATCH("api/orders/{id}/cancel")
    suspend fun cancelOrder(@Path("id") id: String): Response<OrderDto>
}
