package com.example.limitless.service;

import static com.example.limitless.TestUsers.ENCODER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.limitless.TestUsers;
import com.example.limitless.dto.AccessRequestRequest;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

/** Requirements: first-time users request access; the admin is emailed and approves or rejects; the user is emailed. */
@ExtendWith(MockitoExtension.class)
class AccessRequestServiceTest {

    @Mock
    UserRepository userRepository;
    @Mock
    EmailService emailService;

    AccessRequestService service;
    User pending;

    @BeforeEach
    void setUp() {
        UserService userService = new UserService(userRepository, ENCODER);
        service = new AccessRequestService(userRepository, userService, ENCODER, emailService,
                "https://limitless.example");
        pending = new User();
        pending.setId(12);
        pending.setFirstName("Jordan");
        pending.setLastName("Lee");
        pending.setEmailAddress("jlee@email.com");
        pending.setStatus(User.UserStatus.PENDING);
        lenient().when(userRepository.findById(12)).thenReturn(Optional.of(pending));
        lenient().when(userRepository.findByUsername(anyString())).thenReturn(Optional.empty());
        lenient().when(userRepository.findByEmailAddress(anyString())).thenReturn(Optional.empty());
        lenient().when(userRepository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));
    }

    private AccessRequestRequest request(String first, String last, String email) {
        return new AccessRequestRequest(first, last, "123 Example St", LocalDate.of(2000, 1, 1), email,
                "Q1", "Q2", "Q3", "Lincoln", "Atlanta", "Honda");
    }

    private void assertUserError(Runnable call, HttpStatus status, String message) {
        assertThatThrownBy(call::run)
                .isInstanceOf(UserException.class)
                .hasMessage(message)
                .extracting(e -> ((UserException) e).getStatus()).isEqualTo(status);
    }

    @Test
    @DisplayName("TC-REQ-01 (P): request is saved as Pending, answers hashed, administrators emailed")
    void createRequest() {
        User admin = TestUsers.active(1, "sadmin1026", "Admin123!");
        admin.setEmailAddress("admin@limitless.local");
        when(userRepository.findByRole(User.UserRole.ADMINISTRATOR)).thenReturn(List.of(admin));

        User saved = service.createRequest(request("Jordan", "Lee", "jlee@email.com"));

        assertThat(saved.getStatus()).isEqualTo(User.UserStatus.PENDING);
        assertThat(saved.getUsername()).isNull();
        assertThat(saved.getSecurityAnswer1()).isNotEqualTo("Lincoln");
        assertThat(ENCODER.matches("lincoln", saved.getSecurityAnswer1())).isTrue();
        verify(emailService).send(eq("admin@limitless.local"), eq("New access request"), contains("jlee@email.com"));
    }

    @Test
    @DisplayName("TC-REQ-02 (N): missing name or email is rejected")
    void createMissingFields() {
        assertUserError(() -> service.createRequest(request("", "Lee", "jlee@email.com")),
                HttpStatus.BAD_REQUEST, "First name, last name, and email address are required.");
        assertUserError(() -> service.createRequest(request("Jordan", "Lee", " ")),
                HttpStatus.BAD_REQUEST, "First name, last name, and email address are required.");
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("TC-REQ-04 (N): an email already in use is rejected")
    void createDuplicateEmail() {
        when(userRepository.findByEmailAddress("jlee@email.com")).thenReturn(Optional.of(new User()));
        assertUserError(() -> service.createRequest(request("Jordan", "Lee", "jlee@email.com")),
                HttpStatus.CONFLICT, "A user with this email address already exists.");
    }

    @Test
    @DisplayName("TC-REQ-05 (P): approval assigns the chosen role, username and temp password, then emails a login link")
    void approve() {
        User approved = service.approve(12, "manager");

        assertThat(approved.getStatus()).isEqualTo(User.UserStatus.ACTIVATED);
        assertThat(approved.getRole()).isEqualTo(User.UserRole.MANAGER);
        assertThat(approved.getUsername()).matches("jlee\\d{4}");
        assertThat(approved.getPasswordExpiry()).isEqualTo(LocalDate.now().plusDays(90));

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("jlee@email.com"), contains("approved"), body.capture());
        assertThat(body.getValue()).contains("https://limitless.example/login", approved.getUsername());
        String tempPassword = body.getValue().replaceAll("(?s).*Temporary password: (\\S+).*", "$1");
        assertThat(ENCODER.matches(tempPassword, approved.getPasswordHash())).isTrue();
    }

    @Test
    @DisplayName("TC-REQ-05 (P): approval without a role defaults to Accountant")
    void approveDefaultRole() {
        assertThat(service.approve(12, null).getRole()).isEqualTo(User.UserRole.ACCOUNTANT);
    }

    @Test
    @DisplayName("TC-REQ-08 (P): rejection deactivates the request and emails the applicant")
    void reject() {
        assertThat(service.reject(12).getStatus()).isEqualTo(User.UserStatus.DEACTIVATED);
        verify(emailService).send(eq("jlee@email.com"), anyString(), contains("not approved"));
    }

    @Test
    @DisplayName("TC-REQ-09 (N): a request that is no longer pending cannot be approved or rejected")
    void notPending() {
        pending.setStatus(User.UserStatus.ACTIVATED);
        assertUserError(() -> service.approve(12, "MANAGER"), HttpStatus.NOT_FOUND, "Access request doesn't exist");
        assertUserError(() -> service.reject(12), HttpStatus.NOT_FOUND, "Access request doesn't exist");
    }

    @Test
    @DisplayName("TC-REQ-09 (N): an unknown request id returns not found")
    void unknownRequest() {
        when(userRepository.findById(99)).thenReturn(Optional.empty());
        assertUserError(() -> service.approve(99, null), HttpStatus.NOT_FOUND, "Access request doesn't exist");
    }
}
