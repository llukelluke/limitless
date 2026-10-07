package com.example.limitless.service;

import static com.example.limitless.TestUsers.ENCODER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.limitless.TestUsers;
import com.example.limitless.config.JwtService;
import com.example.limitless.dto.ForgotPasswordRequest;
import com.example.limitless.dto.ResetPasswordRequest;
import com.example.limitless.entity.PasswordHistory;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.PasswordHistoryRepository;
import com.example.limitless.repository.UserRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

/** Requirements: forgot password with email + user ID + security questions; password rules; no reuse; hashed. */
@ExtendWith(MockitoExtension.class)
class PasswordServiceTest {

    static final String SECRET = "test-secret-test-secret-test-secret-test-secret";

    @Mock
    UserRepository userRepository;
    @Mock
    PasswordHistoryRepository historyRepository;

    JwtService jwtService = new JwtService(SECRET, 60);
    PasswordService passwordService;
    User user;

    @BeforeEach
    void setUp() {
        passwordService = new PasswordService(userRepository, historyRepository, ENCODER, jwtService);
        user = TestUsers.withAnswers(TestUsers.active(7, "jlee1026", "Current1!"), "lincoln", "atlanta", "honda");
        user.setEmailAddress("jlee@email.com");
        lenient().when(userRepository.findByUsername("jlee1026")).thenReturn(Optional.of(user));
        lenient().when(userRepository.findById(7)).thenReturn(Optional.of(user));
        lenient().when(historyRepository.findByUserId(7)).thenReturn(List.of());
    }

    private ForgotPasswordRequest forgot(String username, String email, String a1) {
        return new ForgotPasswordRequest(username, email, a1, "atlanta", "honda");
    }

    private String validToken() {
        return passwordService.forgotPassword(forgot("jlee1026", "jlee@email.com", "lincoln"));
    }

    private void assertUserError(Runnable call, HttpStatus status, String messageStart) {
        assertThatThrownBy(call::run)
                .isInstanceOf(UserException.class)
                .hasMessageStartingWith(messageStart)
                .extracting(e -> ((UserException) e).getStatus()).isEqualTo(status);
    }

    // ---------- Password rules ----------

    @ParameterizedTest(name = "TC-PW (P): \"{0}\" meets the rules")
    @ValueSource(strings = {"Newpass1!", "a1!aaaaa", "Zebra#2026", "Password1$"})
    void validPasswords(String password) {
        assertThat(PasswordService.meetsRules(password)).isTrue();
    }

    @ParameterizedTest(name = "TC-PW-07..10 (N): \"{0}\" breaks the rules")
    @ValueSource(strings = {"short1!", "1password!", "!password1", "Password1", "Password!", "        "})
    void invalidPasswords(String password) {
        assertThat(PasswordService.meetsRules(password)).isFalse();
    }

    @Test
    @DisplayName("TC-PW (N): null password breaks the rules")
    void nullPassword() {
        assertThat(PasswordService.meetsRules(null)).isFalse();
    }

    // ---------- Forgot password ----------

    @Test
    @DisplayName("TC-PW-01 (P): correct email, user ID and answers issue a reset token")
    void correctAnswersIssueToken() {
        assertThat(validToken()).isNotBlank();
    }

    @Test
    @DisplayName("TC-PW-02 (P): answers are case- and space-insensitive")
    void answersIgnoreCaseAndSpaces() {
        assertThat(passwordService.forgotPassword(
                new ForgotPasswordRequest("jlee1026", "JLEE@email.com", " LINCOLN ", "Atlanta", "HONDA"))).isNotBlank();
    }

    @Test
    @DisplayName("TC-PW (N): missing username or email is a bad request")
    void missingIdentity() {
        assertUserError(() -> passwordService.forgotPassword(forgot("", "jlee@email.com", "lincoln")),
                HttpStatus.BAD_REQUEST, "Username and email address are required.");
        assertUserError(() -> passwordService.forgotPassword(forgot("jlee1026", null, "lincoln")),
                HttpStatus.BAD_REQUEST, "Username and email address are required.");
    }

    @Test
    @DisplayName("TC-PW-05 (N): a wrong answer is rejected")
    void wrongAnswer() {
        assertUserError(() -> passwordService.forgotPassword(forgot("jlee1026", "jlee@email.com", "wrong")),
                HttpStatus.UNAUTHORIZED, "The information provided does not match our records.");
    }

    @Test
    @DisplayName("TC-PW-06 (N): email that doesn't match the user gets the same message")
    void emailMismatch() {
        assertUserError(() -> passwordService.forgotPassword(forgot("jlee1026", "other@email.com", "lincoln")),
                HttpStatus.UNAUTHORIZED, "The information provided does not match our records.");
    }

    @Test
    @DisplayName("TC-PW-06 (N): unknown user gets the same message")
    void unknownUser() {
        when(userRepository.findByUsername("nobody")).thenReturn(Optional.empty());
        assertUserError(() -> passwordService.forgotPassword(forgot("nobody", "jlee@email.com", "lincoln")),
                HttpStatus.UNAUTHORIZED, "The information provided does not match our records.");
    }

    @Test
    @DisplayName("TC-PW (N): user without security answers cannot reset")
    void noAnswersOnFile() {
        user.setSecurityAnswer1(null);
        assertUserError(() -> passwordService.forgotPassword(forgot("jlee1026", "jlee@email.com", "lincoln")),
                HttpStatus.UNAUTHORIZED, "The information provided does not match our records.");
    }

    // ---------- Reset password ----------

    @Test
    @DisplayName("TC-PW-14 (P): valid new password is hashed, saved and the old one is kept in history")
    void resetSucceeds() {
        String oldHash = user.getPasswordHash();
        user.setPasswordAttempts(2);
        passwordService.resetPassword(new ResetPasswordRequest(validToken(), "Newpass1!"));

        assertThat(user.getPasswordHash()).isNotEqualTo("Newpass1!");
        assertThat(ENCODER.matches("Newpass1!", user.getPasswordHash())).isTrue();
        assertThat(user.getPasswordExpiry()).isEqualTo(LocalDate.now().plusDays(90));
        assertThat(user.getPasswordAttempts()).isZero();
        verify(historyRepository).save(any(PasswordHistory.class));
        verify(userRepository).save(user);
        assertThat(oldHash).isNotEqualTo(user.getPasswordHash());
    }

    @Test
    @DisplayName("TC-PW-07 (N): new password breaking the rules is rejected")
    void resetRejectsWeakPassword() {
        String token = validToken();
        assertUserError(() -> passwordService.resetPassword(new ResetPasswordRequest(token, "short")),
                HttpStatus.BAD_REQUEST, "Password must be at least 8 characters");
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("TC-PW-12 (N): current password cannot be reused")
    void resetRejectsCurrentPassword() {
        String token = validToken();
        assertUserError(() -> passwordService.resetPassword(new ResetPasswordRequest(token, "Current1!")),
                HttpStatus.CONFLICT, "This password has been used before.");
    }

    @Test
    @DisplayName("TC-PW-13 (N): a password from history cannot be reused")
    void resetRejectsOldPassword() {
        when(historyRepository.findByUserId(7)).thenReturn(
                List.of(new PasswordHistory(user, ENCODER.encode("Older123!"), LocalDate.now().minusDays(100))));
        String token = validToken();
        assertUserError(() -> passwordService.resetPassword(new ResetPasswordRequest(token, "Older123!")),
                HttpStatus.CONFLICT, "This password has been used before.");
    }

    @Test
    @DisplayName("TC-PW-15 (N): a reset token works only once")
    void tokenSingleUse() {
        String token = validToken();
        passwordService.resetPassword(new ResetPasswordRequest(token, "Newpass1!"));
        assertUserError(() -> passwordService.resetPassword(new ResetPasswordRequest(token, "Another1!")),
                HttpStatus.UNAUTHORIZED, "This reset link is invalid or has expired.");
    }

    @Test
    @DisplayName("TC-PW (N): missing, garbage or login tokens are rejected")
    void invalidTokens() {
        String loginToken = jwtService.generateToken(7, "jlee1026", "ACCOUNTANT");
        for (String token : new String[] {null, "not-a-token", loginToken}) {
            assertUserError(() -> passwordService.resetPassword(new ResetPasswordRequest(token, "Newpass1!")),
                    HttpStatus.UNAUTHORIZED, "This reset link is invalid or has expired.");
        }
    }

    @Test
    @DisplayName("TC-PW (N): token signed with a different secret is rejected")
    void foreignToken() {
        String forged = new JwtService("another-secret-another-secret-another-secret", 60).generateResetToken(7, 0);
        assertUserError(() -> passwordService.resetPassword(new ResetPasswordRequest(forged, "Newpass1!")),
                HttpStatus.UNAUTHORIZED, "This reset link is invalid or has expired.");
    }
}
