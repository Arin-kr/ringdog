package com.ringdog.android.data.remote.api

import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.remote.dto.ProductListResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface ProductApi {
    @GET("api/products")
    suspend fun getProducts(@Query("page") page: Int, @Query("limit") limit: Int): Response<ProductListResponse>

    @GET("api/products/{id}")
    suspend fun getProduct(@Path("id") id: String): Response<ProductDto>
}
