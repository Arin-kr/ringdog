package com.ringdog.android.data

import com.ringdog.android.data.remote.NetworkModule
import com.ringdog.android.data.repository.AuthRepository
import com.ringdog.android.data.repository.CartRepository

// Repository singletons are added here one at a time as each domain area
// (auth, cart, product, order) is implemented in later tasks.
object AppContainer {
    val authRepository: AuthRepository by lazy { AuthRepository(NetworkModule.authApi) }
    val cartRepository: CartRepository by lazy { CartRepository(NetworkModule.cartApi) }
}
