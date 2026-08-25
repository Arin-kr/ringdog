package com.ringdog.android.data.remote.dto

import com.google.gson.annotations.SerializedName

data class AddCartItemRequest(
    @SerializedName("product_id") val productId: String,
    val quantity: Int,
)

data class CartItemDto(
    val id: String,
    val userId: String,
    val productId: String,
    val quantity: Int,
    val createdAt: String,
    // Present on GET /api/cart (includes the product relation); null on the
    // POST /api/cart/items response, which returns the raw upserted row.
    val product: ProductDto? = null,
)

data class CartListResponse(val items: List<CartItemDto>)
