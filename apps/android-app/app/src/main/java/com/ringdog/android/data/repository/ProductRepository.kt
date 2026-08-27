package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.ProductApi
import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.remote.dto.ProductListResponse
import com.ringdog.android.data.safeApiCall

class ProductRepository(private val api: ProductApi) {
    suspend fun getProducts(page: Int = 1, limit: Int = 20): ApiResult<ProductListResponse> =
        safeApiCall { api.getProducts(page, limit) }

    suspend fun getProduct(id: String): ApiResult<ProductDto> = safeApiCall { api.getProduct(id) }
}
