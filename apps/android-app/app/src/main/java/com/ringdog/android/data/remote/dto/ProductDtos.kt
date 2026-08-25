package com.ringdog.android.data.remote.dto

data class ProductDto(
    val id: String,
    val name: String,
    val description: String,
    val price: String,
    val stock: Int,
    val tags: List<String>,
    val imageUrl: String?,
    val createdAt: String,
)

data class ProductListResponse(
    val items: List<ProductDto>,
    val page: Int,
    val limit: Int,
    val total: Int,
)
