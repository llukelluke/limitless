package com.example.limitless.service;

import static com.example.limitless.TestUsers.ENCODER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.limitless.TestUsers;
import com.example.limitless.dto.CreateUserRequest;
import com.example.limitless.dto.CreateUserResponse;
import com.example.limitless.dto.SuspendRequest;
import com.example.limitless.dto.UpdateUserRequest;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.UserRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

/** Requirements: admin creates users with roles, updates them, activates/deactivates, suspends for a date range. */
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    UserRepository userRepository;

    UserService userService;
    User existing;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, ENCODER);
        existing = TestUsers.active(7, "jlee1026", "Secret12!");
        existing.setEmailAddress("jlee@email.com");
        lenient().when(userRepository.findById(7)).thenReturn(Optional.of(existing));
        lenient().when(userRepository.findByUsername(anyString())).thenReturn(Optional.empty());
        lenient().when(userRepository.findByEmailAddress(anyString())).thenReturn(Optional.empty());
        lenient().when(userRepository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));
    }

    private CreateUserRequest createRequest(String first, String last, String email, String role) {
        return new CreateUserRequest(first, last, email, "789 Example Road", LocalDate.of(1998, 3, 3), role,
                null, null, null, null, null, null);
    }

    private void assertUserError(Runnable call, HttpStatus status, String message) {
        assertThatThrownBy(call::run)
                .isInstanceOf(UserException.class)
                .hasMessage(message)
                .extracting(e -> ((UserException) e).getStatus()).isEqualTo(status);
    }

    // ---------- Username ----------

    @Test
    @DisplayName("TC-REQ-06 (P): username = first initial + last name + MMYY")
    void usernameFormat() {
        assertThat(userService.generateUsername("Jordan", "Lee", LocalDate.of(2026, 10, 6))).isEqualTo("jlee1026");
        assertThat(userService.generateUsername("Ana", "Lopez", LocalDate.of(2027, 3, 1))).isEqualTo("alopez0327");
    }

    @Test
    @DisplayName("TC-REQ-06 (P): spaces and punctuation are dropped from usernames")
    void usernameStripsSymbols() {
        assertThat(userService.generateUsername("Mary", "O'Neil-Smith", LocalDate.of(2026, 1, 15)))
                .isEqualTo("moneilsmith0126");
    }

    @Test
    @DisplayName("TC-REQ-07 (P): duplicate usernames get a numeric suffix")
    void usernameCollision() {
        when(userRepository.findByUsername("jlee1026")).thenReturn(Optional.of(existing));
        assertThat(userService.generateUsername("Jordan", "Lee", LocalDate.of(2026, 10, 6))).isEqualTo("jlee10262");
    }

    @Test
    @DisplayName("TC-USR-01 (P): temporary passwords always meet the password rules")
    void tempPasswordsMeetRules() {
        for (int i = 0; i < 200; i++) {
            assertThat(PasswordService.meetsRules(userService.generateTempPassword())).isTrue();
        }
    }

    // ---------- Create ----------

    @Test
    @DisplayName("TC-USR-01 (P): admin creates an active user with a role and a hashed temporary password")
    void createUser() {
        CreateUserResponse response = userService.createUser(
                createRequest("Taylor", "Brown", "tbrown@email.com", "accountant"), "sadmin1026");

        assertThat(response.user().username()).startsWith("tbrown");
        assertThat(response.user().role()).isEqualTo("ACCOUNTANT");
        assertThat(response.user().status()).isEqualTo("ACTIVATED");
        assertThat(response.user().passwordExpiry()).isEqualTo(LocalDate.now().plusDays(90));
        assertThat(PasswordService.meetsRules(response.temporaryPassword())).isTrue();
        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("TC-USR-02/03 (N): missing name, email or role is rejected")
    void createMissingFields() {
        assertUserError(() -> userService.createUser(createRequest("", "Brown", "t@email.com", "MANAGER"), "admin"),
                HttpStatus.BAD_REQUEST, "One or more fields are invalid.");
        assertUserError(() -> userService.createUser(createRequest("Taylor", "Brown", null, "MANAGER"), "admin"),
                HttpStatus.BAD_REQUEST, "One or more fields are invalid.");
        assertUserError(() -> userService.createUser(createRequest("Taylor", "Brown", "t@email.com", null), "admin"),
                HttpStatus.BAD_REQUEST, "One or more fields are invalid.");
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("TC-USR (N): an unknown role is rejected")
    void createUnknownRole() {
        assertUserError(() -> userService.createUser(createRequest("Taylor", "Brown", "t@email.com", "CEO"), "admin"),
                HttpStatus.BAD_REQUEST, "One or more fields are invalid.");
    }

    @Test
    @DisplayName("TC-USR-04 (N): an email already in use is rejected")
    void createDuplicateEmail() {
        when(userRepository.findByEmailAddress("jlee@email.com")).thenReturn(Optional.of(existing));
        assertUserError(() -> userService.createUser(createRequest("J", "Lee", "jlee@email.com", "MANAGER"), "admin"),
                HttpStatus.CONFLICT, "A user with this email address already exists.");
    }

    // ---------- Update ----------

    @Test
    @DisplayName("TC-USR-08/09 (P): admin updates details and role; blank fields are left unchanged")
    void updateUser() {
        User updated = userService.updateUser(7, new UpdateUserRequest(
                null, null, null, "42 Updated Ave", null, null, "MANAGER"));

        assertThat(updated.getHomeAddress()).isEqualTo("42 Updated Ave");
        assertThat(updated.getRole()).isEqualTo(User.UserRole.MANAGER);
        assertThat(updated.getFirstName()).isEqualTo("Jordan");
        assertThat(updated.getUsername()).isEqualTo("jlee1026");
    }

    @Test
    @DisplayName("TC-USR-11 (N): changing email to one another user has is rejected")
    void updateDuplicateEmail() {
        when(userRepository.findByEmailAddress("taken@email.com")).thenReturn(Optional.of(new User()));
        assertUserError(() -> userService.updateUser(7, new UpdateUserRequest(
                        null, null, "taken@email.com", null, null, null, null)),
                HttpStatus.CONFLICT, "A user with this email address already exists.");
    }

    @Test
    @DisplayName("TC-USR (N): editing a user that doesn't exist returns not found")
    void updateMissingUser() {
        when(userRepository.findById(99)).thenReturn(Optional.empty());
        assertUserError(() -> userService.getUserById(99), HttpStatus.NOT_FOUND, "User doesn't exist.");
    }

    // ---------- Activate / deactivate / suspend ----------

    @Test
    @DisplayName("TC-USR-12 (P): deactivate sets status Deactivated")
    void deactivate() {
        assertThat(userService.deactivateUser(7).getStatus()).isEqualTo(User.UserStatus.DEACTIVATED);
    }

    @Test
    @DisplayName("TC-USR-13 (P): activate restores access and clears suspension and failed attempts")
    void activate() {
        existing.setStatus(User.UserStatus.SUSPENDED);
        existing.setSuspensionStart(LocalDate.now());
        existing.setSuspensionEnd(LocalDate.now().plusDays(5));
        existing.setPasswordAttempts(3);

        User user = userService.activateUser(7);
        assertThat(user.getStatus()).isEqualTo(User.UserStatus.ACTIVATED);
        assertThat(user.getSuspensionStart()).isNull();
        assertThat(user.getSuspensionEnd()).isNull();
        assertThat(user.getPasswordAttempts()).isZero();
    }

    @Test
    @DisplayName("TC-USR-14 (P): suspend for a date range")
    void suspend() {
        LocalDate start = LocalDate.of(2026, 11, 1);
        LocalDate end = LocalDate.of(2026, 12, 1);
        User user = userService.suspendUser(7, new SuspendRequest(start, end));
        assertThat(user.getStatus()).isEqualTo(User.UserStatus.SUSPENDED);
        assertThat(user.getSuspensionStart()).isEqualTo(start);
        assertThat(user.getSuspensionEnd()).isEqualTo(end);
    }

    @Test
    @DisplayName("TC-USR-15/16 (N): suspension needs both dates with the end after the start")
    void suspendInvalidDates() {
        LocalDate day = LocalDate.of(2026, 11, 1);
        for (SuspendRequest request : List.of(
                new SuspendRequest(day, day.minusDays(1)),
                new SuspendRequest(day, day),
                new SuspendRequest(day, null),
                new SuspendRequest(null, day))) {
            assertUserError(() -> userService.suspendUser(7, request),
                    HttpStatus.BAD_REQUEST, "Suspension end date must be after the start date.");
        }
        verify(userRepository, never()).save(any());
    }

    // ---------- Reports ----------

    @Test
    @DisplayName("TC-RPT-02 (P): expired-password report asks for passwords expiring before today")
    void expiredReport() {
        when(userRepository.findByPasswordExpiryBefore(LocalDate.now())).thenReturn(List.of(existing));
        assertThat(userService.getUsersWithExpiredPasswords()).containsExactly(existing);
    }
}
