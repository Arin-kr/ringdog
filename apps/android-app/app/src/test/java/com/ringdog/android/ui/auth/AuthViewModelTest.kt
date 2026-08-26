package com.ringdog.android.ui.auth

import app.cash.turbine.test
import com.ringdog.android.MainDispatcherRule
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.LoginResponse
import com.ringdog.android.data.repository.AuthRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class AuthViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val repository = mockk<AuthRepository>()

    @Test
    fun `login emits Loading then Success`() = runTest {
        coEvery { repository.login("a@b.com", "password123") } returns ApiResult.Success(LoginResponse("t", "1h"))
        val viewModel = AuthViewModel(repository)

        viewModel.uiState.test {
            assertEquals(AuthUiState.Idle, awaitItem())
            viewModel.login("a@b.com", "password123")
            assertEquals(AuthUiState.Loading, awaitItem())
            assertEquals(AuthUiState.Success, awaitItem())
        }
    }

    @Test
    fun `login emits Loading then Error on failure`() = runTest {
        coEvery { repository.login("a@b.com", "wrong") } returns ApiResult.Error("Invalid email or password", 401)
        val viewModel = AuthViewModel(repository)

        viewModel.uiState.test {
            assertEquals(AuthUiState.Idle, awaitItem())
            viewModel.login("a@b.com", "wrong")
            assertEquals(AuthUiState.Loading, awaitItem())
            assertEquals(AuthUiState.Error("Invalid email or password"), awaitItem())
        }
    }
}
