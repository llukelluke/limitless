package com.example.limitless.config;

import static com.example.limitless.TestUsers.ENCODER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.limitless.entity.User;
import com.example.limitless.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** The first administrator is created from ADMIN_* settings on an empty database. */
@ExtendWith(MockitoExtension.class)
class AdminBootstrapTest {

    @Mock
    UserRepository userRepository;

    @BeforeEach
    void setUp() {
        lenient().when(userRepository.findByRole(User.UserRole.ADMINISTRATOR)).thenReturn(List.of());
        lenient().when(userRepository.findByUsername("admin")).thenReturn(Optional.empty());
        lenient().when(userRepository.findByEmailAddress("owner@example.com")).thenReturn(Optional.empty());
    }

    private void run(String password) {
        new AdminBootstrap(userRepository, ENCODER, "admin", "owner@example.com", password).run(null);
    }

    @Test
    @DisplayName("(P) creates an active administrator with a hashed password")
    void createsAdmin() {
        run("Deploy123!");
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        User admin = saved.getValue();
        assertThat(admin.getUsername()).isEqualTo("admin");
        assertThat(admin.getRole()).isEqualTo(User.UserRole.ADMINISTRATOR);
        assertThat(admin.getStatus()).isEqualTo(User.UserStatus.ACTIVATED);
        assertThat(ENCODER.matches("Deploy123!", admin.getPasswordHash())).isTrue();
    }

    @Test
    @DisplayName("(N) does nothing when ADMIN_PASSWORD is not set")
    void noPassword() {
        run("");
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("(N) does nothing when an administrator already exists")
    void adminExists() {
        when(userRepository.findByRole(User.UserRole.ADMINISTRATOR)).thenReturn(List.of(new User()));
        run("Deploy123!");
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("(N) refuses a password that breaks the password rules")
    void weakPassword() {
        run("password");
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("(N) refuses when the username is already taken")
    void usernameTaken() {
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(new User()));
        run("Deploy123!");
        verify(userRepository, never()).save(any());
    }
}
