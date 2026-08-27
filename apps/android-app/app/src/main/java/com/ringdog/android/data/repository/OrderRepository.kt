package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.OrderApi
import com.ringdog.android.data.remote.dto.CheckoutRequest
import com.ringdog.android.data.remote.dto.CheckoutResponse
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.remote.dto.OrderListResponse
import com.ringdog.android.data.safeApiCall

class OrderRepository(private val api: OrderApi) {
    suspend fun checkout(couponCode: String? = null): ApiResult<CheckoutResponse> =
        safeApiCall { api.checkout(CheckoutRequest(couponCode)) }

    suspend fun getOrders(): ApiResult<OrderListResponse> = safeApiCall { api.getOrders() }

    suspend fun getOrder(id: String): ApiResult<OrderDto> = safeApiCall { api.getOrder(id) }

    suspend fun cancelOrder(id: String): ApiResult<OrderDto> = safeApiCall { api.cancelOrder(id) }
}
