package com.ringdog.android.data.remote.dto

import com.google.gson.annotations.SerializedName

data class CheckoutRequest(@SerializedName("coupon_code") val couponCode: String? = null)

data class CheckoutResponse(
    @SerializedName("order_id") val orderId: String,
    val status: String,
    @SerializedName("total_amount") val totalAmount: Double,
)

data class OrderItemDto(
    val id: String,
    val orderId: String,
    val productId: String,
    val quantity: Int,
    val unitPrice: String,
    val product: ProductDto,
)

data class OrderDto(
    val id: String,
    val userId: String,
    val totalAmount: String,
    val couponCode: String?,
    val status: String,
    val createdAt: String,
    val items: List<OrderItemDto>,
)

data class OrderListResponse(val items: List<OrderDto>)
