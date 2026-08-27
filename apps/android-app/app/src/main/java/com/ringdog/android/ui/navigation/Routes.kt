package com.ringdog.android.ui.navigation

object Routes {
    const val LOGIN = "login"
    const val SIGNUP = "signup"
    const val PRODUCT_LIST = "products"
    const val PRODUCT_DETAIL = "products/{productId}"
    const val CART = "cart"
    const val ORDER_HISTORY = "orders"
    const val ORDER_DETAIL = "orders/{orderId}"

    fun productDetail(productId: String) = "products/$productId"
    fun orderDetail(orderId: String) = "orders/$orderId"
}
