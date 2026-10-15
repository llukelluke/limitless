package com.example.limitless.service;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.limitless.TestUsers;
import com.example.limitless.entity.User;
import com.example.limitless.repository.UserRepository;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Requirement: users are notified three days before their password expires. */
@ExtendWith(MockitoExtension.class)
class PasswordExpiryNotifierTest {

    @Mock
    UserRepository userRepository;
    @Mock
    EmailService emailService;

    @Test
    @DisplayName("TC-EXP-01 (P): users whose password expires on the date are emailed")
    void notifiesExpiringUsers() {
        LocalDate inThreeDays = LocalDate.now().plusDays(3);
        User user = TestUsers.active(7, "jlee1026", "Secret12!");
        when(userRepository.findByPasswordExpiry(inThreeDays)).thenReturn(List.of(user));

        new PasswordExpiryNotifier(userRepository, emailService).notifyUsersExpiringOn(inThreeDays);

        verify(emailService).send(eq(user.getEmailAddress()), eq("Your password expires soon"),
                contains(inThreeDays.toString()));
    }

    @Test
    @DisplayName("TC-EXP-02 (N): nobody is emailed when no password expires on the date")
    void noOneToNotify() {
        LocalDate inThreeDays = LocalDate.now().plusDays(3);
        when(userRepository.findByPasswordExpiry(inThreeDays)).thenReturn(List.of());

        new PasswordExpiryNotifier(userRepository, emailService).notifyUsersExpiringOn(inThreeDays);

        verify(emailService, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("TC-EXP-01 (P): the daily job looks exactly three days ahead")
    void dailyJobLooksThreeDaysAhead() {
        new PasswordExpiryNotifier(userRepository, emailService).notifyExpiringPasswords();
        verify(userRepository).findByPasswordExpiry(LocalDate.now().plusDays(3));
    }
}
