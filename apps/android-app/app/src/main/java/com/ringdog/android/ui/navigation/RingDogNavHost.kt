package com.ringdog.android.ui.navigation

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.ringdog.android.data.AppContainer
import com.ringdog.android.data.local.TokenStore
import com.ringdog.android.data.remote.AuthEventBus
import com.ringdog.android.ui.auth.AuthViewModel
import com.ringdog.android.ui.auth.LoginScreen
import com.ringdog.android.ui.auth.SignupScreen
import com.ringdog.android.ui.cart.CartCheckoutSection
import com.ringdog.android.ui.cart.CartScreen
import com.ringdog.android.ui.cart.CartViewModel
import com.ringdog.android.ui.order.OrderDetailScreen
import com.ringdog.android.ui.order.OrderDetailViewModel
import com.ringdog.android.ui.order.OrderHistoryScreen
import com.ringdog.android.ui.order.OrderHistoryViewModel
import com.ringdog.android.ui.product.ProductDetailScreen
import com.ringdog.android.ui.product.ProductDetailViewModel
import com.ringdog.android.ui.product.ProductListScreen
import com.ringdog.android.ui.product.ProductListViewModel

@Composable
fun RingDogNavHost(navController: NavHostController) {
    val startDestination = if (TokenStore.isLoggedIn()) Routes.PRODUCT_LIST else Routes.LOGIN

    LaunchedEffect(Unit) {
        AuthEventBus.sessionExpired.collect {
            navController.navigate(Routes.LOGIN) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable(Routes.LOGIN) {
            val viewModel = viewModel { AuthViewModel(AppContainer.authRepository) }
            LoginScreen(
                viewModel = viewModel,
                onLoginSuccess = {
                    navController.navigate(Routes.PRODUCT_LIST) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onNavigateToSignup = { navController.navigate(Routes.SIGNUP) },
            )
        }

        composable(Routes.SIGNUP) {
            val viewModel = viewModel { AuthViewModel(AppContainer.authRepository) }
            SignupScreen(
                viewModel = viewModel,
                onSignupSuccess = { navController.popBackStack() },
                onNavigateToLogin = { navController.popBackStack() },
            )
        }

        composable(Routes.PRODUCT_LIST) {
            val viewModel = viewModel { ProductListViewModel(AppContainer.productRepository) }
            ProductListScreen(
                viewModel = viewModel,
                onProductClick = { productId -> navController.navigate(Routes.productDetail(productId)) },
                onCartClick = { navController.navigate(Routes.CART) },
                onOrderHistoryClick = { navController.navigate(Routes.ORDER_HISTORY) },
            )
        }

        composable(
            route = Routes.PRODUCT_DETAIL,
            arguments = listOf(navArgument("productId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val productId = requireNotNull(backStackEntry.arguments?.getString("productId"))
            val viewModel = viewModel {
                ProductDetailViewModel(productId, AppContainer.productRepository, AppContainer.cartRepository)
            }
            ProductDetailScreen(viewModel = viewModel, onNavigateToCart = { navController.navigate(Routes.CART) })
        }

        composable(Routes.CART) {
            val cartViewModel = viewModel { CartViewModel(AppContainer.cartRepository) }
            val orderViewModel = viewModel { OrderHistoryViewModel(AppContainer.orderRepository) }
            Column {
                CartScreen(viewModel = cartViewModel, modifier = Modifier.weight(1f))
                CartCheckoutSection(
                    orderViewModel = orderViewModel,
                    onCheckoutSuccess = { orderId ->
                        navController.navigate(Routes.orderDetail(orderId)) {
                            popUpTo(Routes.PRODUCT_LIST)
                        }
                    },
                )
            }
        }

        composable(Routes.ORDER_HISTORY) {
            val viewModel = viewModel { OrderHistoryViewModel(AppContainer.orderRepository) }
            OrderHistoryScreen(
                viewModel = viewModel,
                onOrderClick = { orderId -> navController.navigate(Routes.orderDetail(orderId)) },
            )
        }

        composable(
            route = Routes.ORDER_DETAIL,
            arguments = listOf(navArgument("orderId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val orderId = requireNotNull(backStackEntry.arguments?.getString("orderId"))
            val viewModel = viewModel { OrderDetailViewModel(orderId, AppContainer.orderRepository) }
            OrderDetailScreen(viewModel = viewModel)
        }
    }
}
