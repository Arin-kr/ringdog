package com.ringdog.android.ui.product

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductDetailScreen(
    viewModel: ProductDetailViewModel,
    onNavigateToCart: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState.addedToCart) {
        if (uiState.addedToCart) {
            onNavigateToCart()
            viewModel.onNavigatedToCart()
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (uiState.isLoading) {
            CircularProgressIndicator()
        }

        uiState.errorMessage?.let { Text(it) }

        uiState.product?.let { product ->
            Text(product.name)
            Text(product.description)
            Text("₩${product.price}")
            Text("재고: ${product.stock}")
            Button(onClick = { viewModel.addToCart() }) {
                Text("장바구니에 담기")
            }
        }
    }
}
