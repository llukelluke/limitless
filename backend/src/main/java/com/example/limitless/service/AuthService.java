package com.example.limitless.service;

import com.example.limitless.entity.User;
import com.example.limitless.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.time.LocalDate;

@Service
public class AuthService {

    private static final int MAX_FAILED_ATTEMPTS = 3;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /** Attempts to authenticate a user when they try to login
     *This method checks the inputted username in the database and if it exists and isnt suspended or inactive
     *then it will check if the password matches, if so it will return the user
     */
    // noRollbackFor: a failed login throws, but the failed-attempt count and suspension must still be saved
    @Transactional(noRollbackFor = AuthenticationException.class)
    public User login(String username, String password) {
        // A blank field is a typo, not a guess: refuse it without counting a failed attempt.
        if (username == null || username.isBlank() || password == null || password.isEmpty()) {
            throw new AuthenticationException("Please enter your username and password.", HttpStatus.BAD_REQUEST);
        }
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new AuthenticationException("Invalid username or password.", HttpStatus.UNAUTHORIZED));

        if (user.getStatus() == User.UserStatus.SUSPENDED) {
            LocalDate end = user.getSuspensionEnd();
            if (end != null && end.isBefore(LocalDate.now())) {
                user.setStatus(User.UserStatus.ACTIVATED);
                user.setSuspensionStart(null);
                user.setSuspensionEnd(null);
                user.setPasswordAttempts(0);
                userRepository.save(user);
            } else {
                throw new AuthenticationException("This account is suspended.", HttpStatus.FORBIDDEN);
            }
        }
        if (user.getStatus() == User.UserStatus.DEACTIVATED) {
            throw new AuthenticationException("This account is deactivated.", HttpStatus.FORBIDDEN);
        }
        if (user.getStatus() == User.UserStatus.PENDING) {
            throw new AuthenticationException("This account is pending approval.", HttpStatus.FORBIDDEN);
        }

        boolean passwordMatches = passwordEncoder.matches(password, user.getPasswordHash());

        if (!passwordMatches) {
            handleFailedAttempt(user);
            throw new AuthenticationException("Invalid username or password.", HttpStatus.UNAUTHORIZED);
        }

        java.time.LocalDateTime tempExpiry = user.getTempPasswordExpiresAt();
        if (tempExpiry != null && tempExpiry.isBefore(java.time.LocalDateTime.now())) {
            throw new AuthenticationException(
                    "Your temporary password has expired. Ask an administrator for a new one.", HttpStatus.FORBIDDEN);
        }

        // Successful login resets the failed-attempt counter
        user.setPasswordAttempts(0);
        userRepository.save(user);

        return user;
    }

    private void handleFailedAttempt(User user) {
        int attempts = user.getPasswordAttempts() == null ? 0 : user.getPasswordAttempts();
        attempts++;
        user.setPasswordAttempts(attempts);

        if (attempts >= MAX_FAILED_ATTEMPTS) {
            user.setStatus(User.UserStatus.SUSPENDED);
            user.setSuspensionStart(LocalDate.now());
        }

        userRepository.save(user);
    }

    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public static class AuthenticationException extends RuntimeException {
        private final HttpStatus status;

        public AuthenticationException(String message, HttpStatus status) {
            super(message);
            this.status = status;
        }

        public HttpStatus getStatus() {
            return status;
        }
    }

}