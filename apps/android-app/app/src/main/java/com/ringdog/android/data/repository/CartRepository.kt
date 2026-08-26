package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.CartApi
import com.ringdog.android.data.remote.dto.AddCartItemRequest
import com.ringdog.android.data.remote.dto.CartItemDto
import com.ringdog.android.data.remote.dto.CartListResponse
import com.ringdog.android.data.safeApiCall

class CartRepository(private val api: CartApi) {
    suspend fun getCart(): ApiResult<CartListResponse> = safeApiCall { api.getCart() }

    suspend fun addItem(productId: String, quantity: Int): ApiResult<CartItemDto> =
        safeApiCall { api.addItem(AddCartItemRequest(productId, quantity)) }

    suspend fun removeItem(cartItemId: String): ApiResult<Unit> = safeApiCall { api.removeItem(cartItemId) }
}
