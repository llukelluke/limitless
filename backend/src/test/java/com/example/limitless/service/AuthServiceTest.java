package com.example.limitless.service;

import static com.example.limitless.TestUsers.ENCODER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.example.limitless.TestUsers;
import com.example.limitless.entity.User;
import com.example.limitless.repository.UserRepository;
import com.example.limitless.service.AuthService.AuthenticationException;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

/** Requirements: users log in; 3 wrong passwords suspend; suspended/deactivated users are blocked. */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    UserRepository userRepository;

    AuthService authService;
    User user;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, ENCODER);
        user = TestUsers.active(7, "jlee1026", "Secret12!");
        lenient().when(userRepository.findByUsername("jlee1026")).thenReturn(Optional.of(user));
        lenient().when(userRepository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));
    }

    private void assertRejected(String password, HttpStatus status, String message) {
        assertThatThrownBy(() -> authService.login("jlee1026", password))
                .isInstanceOf(AuthenticationException.class)
                .hasMessage(message)
                .extracting(e -> ((AuthenticationException) e).getStatus()).isEqualTo(status);
    }

    @Test
    @DisplayName("TC-LOGIN-01/02 (P): correct password logs in")
    void loginSucceeds() {
        assertThat(authService.login("jlee1026", "Secret12!")).isSameAs(user);
    }

    @Test
    @DisplayName("TC-LOGIN-05 (N): wrong password is rejected and counted")
    void wrongPasswordRejected() {
        assertRejected("Wrong123!", HttpStatus.UNAUTHORIZED, "Invalid username or password.");
        assertThat(user.getPasswordAttempts()).isEqualTo(1);
        assertThat(user.getStatus()).isEqualTo(User.UserStatus.ACTIVATED);
    }

    @Test
    @DisplayName("TC-LOGIN-06 (N): unknown username gets the same message as a wrong password")
    void unknownUserRejected() {
        when(userRepository.findByUsername("nobody")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> authService.login("nobody", "Secret12!"))
                .isInstanceOf(AuthenticationException.class)
                .hasMessage("Invalid username or password.");
    }

    @Test
    @DisplayName("TC-LOGIN-07 (N): third wrong password suspends the account")
    void thirdFailureSuspends() {
        for (int i = 0; i < 3; i++) {
            assertRejected("Wrong123!", HttpStatus.UNAUTHORIZED, "Invalid username or password.");
        }
        assertThat(user.getStatus()).isEqualTo(User.UserStatus.SUSPENDED);
        assertThat(user.getSuspensionStart()).isEqualTo(LocalDate.now());
        assertRejected("Secret12!", HttpStatus.FORBIDDEN, "This account is suspended.");
    }

    @Test
    @DisplayName("TC-LOGIN-08 (P): successful login resets the failed-attempt counter")
    void successResetsAttempts() {
        user.setPasswordAttempts(2);
        authService.login("jlee1026", "Secret12!");
        assertThat(user.getPasswordAttempts()).isZero();
    }

    @Test
    @DisplayName("TC-LOGIN-09 (N): deactivated account is blocked")
    void deactivatedBlocked() {
        user.setStatus(User.UserStatus.DEACTIVATED);
        assertRejected("Secret12!", HttpStatus.FORBIDDEN, "This account is deactivated.");
    }

    @Test
    @DisplayName("TC-LOGIN-10 (N): pending account is blocked")
    void pendingBlocked() {
        user.setStatus(User.UserStatus.PENDING);
        assertRejected("Secret12!", HttpStatus.FORBIDDEN, "This account is pending approval.");
    }

    @Test
    @DisplayName("TC-LOGIN-11 (P): suspension that has ended is lifted at login")
    void endedSuspensionLifted() {
        user.setStatus(User.UserStatus.SUSPENDED);
        user.setSuspensionStart(LocalDate.now().minusDays(10));
        user.setSuspensionEnd(LocalDate.now().minusDays(1));
        assertThat(authService.login("jlee1026", "Secret12!")).isSameAs(user);
        assertThat(user.getStatus()).isEqualTo(User.UserStatus.ACTIVATED);
        assertThat(user.getSuspensionEnd()).isNull();
    }

    @Test
    @DisplayName("TC-LOGIN-12 (N): active scheduled suspension blocks login")
    void activeSuspensionBlocks() {
        user.setStatus(User.UserStatus.SUSPENDED);
        user.setSuspensionStart(LocalDate.now().minusDays(1));
        user.setSuspensionEnd(LocalDate.now().plusDays(5));
        assertRejected("Secret12!", HttpStatus.FORBIDDEN, "This account is suspended.");
    }
}
