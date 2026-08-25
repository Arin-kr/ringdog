package com.ringdog.android.data.remote.api

import com.ringdog.android.data.remote.dto.AddCartItemRequest
import com.ringdog.android.data.remote.dto.CartItemDto
import com.ringdog.android.data.remote.dto.CartListResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface CartApi {
    @GET("api/cart")
    suspend fun getCart(): Response<CartListResponse>

    @POST("api/cart/items")
    suspend fun addItem(@Body request: AddCartItemRequest): Response<CartItemDto>

    @DELETE("api/cart/items/{id}")
    suspend fun removeItem(@Path("id") id: String): Response<Unit>
}
