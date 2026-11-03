package com.example.limitless.service;

import com.example.limitless.entity.PasswordHistory;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.PasswordHistoryRepository;
import com.example.limitless.repository.UserRepository;
import com.example.limitless.config.JwtService;
import com.example.limitless.dto.ForgotPasswordRequest;
import com.example.limitless.dto.ResetPasswordRequest;
import io.jsonwebtoken.Claims;
import java.time.LocalDate;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordService {

    // 8+ chars, starts with a letter, contains a digit and a special character
    private static final Pattern RULES = Pattern.compile("^[A-Za-z](?=.*\\d)(?=.*[^A-Za-z0-9]).{7,}$");
    private static final int PASSWORD_LIFETIME_DAYS = 90;
    private static final String MISMATCH = "The information provided does not match our records.";

    private final UserRepository userRepository;
    private final PasswordHistoryRepository historyRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public PasswordService(UserRepository userRepository,
                           PasswordHistoryRepository historyRepository,
                           PasswordEncoder passwordEncoder,
                           JwtService jwtService) {
        this.userRepository = userRepository;
        this.historyRepository = historyRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public static boolean meetsRules(String password) {
        return password != null && RULES.matcher(password).matches();
    }

    /** Item 9: verify username + email + 3 security answers, then issue a short-lived reset token. */
    @Transactional(readOnly = true)
    public String forgotPassword(ForgotPasswordRequest req) {
        if (isBlank(req.username()) || isBlank(req.emailAddress())) {
            throw new UserException(HttpStatus.BAD_REQUEST, "Username and email address are required.");
        }
        User user = userRepository.findByUsername(req.username().trim()).orElse(null);
        if (user == null
                || user.getEmailAddress() == null
                || !user.getEmailAddress().equalsIgnoreCase(req.emailAddress().trim())
                || !answerMatches(req.securityAnswer1(), user.getSecurityAnswer1())
                || !answerMatches(req.securityAnswer2(), user.getSecurityAnswer2())
                || !answerMatches(req.securityAnswer3(), user.getSecurityAnswer3())) {
            // Same message for every failure so attackers can't tell which accounts exist
            throw new UserException(HttpStatus.UNAUTHORIZED, MISMATCH);
        }
        return jwtService.generateResetToken(user.getId(), fingerprint(user));
    }

    /** Items 10, 11, 12: validate rules, block reuse, store hashed, keep history. */
    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        Claims claims = req.resetToken() == null ? null : jwtService.parse(req.resetToken());
        if (claims == null || !"reset".equals(claims.get("purpose", String.class))) {
            throw new UserException(HttpStatus.UNAUTHORIZED, "This reset link is invalid or has expired.");
        }
        User user = userRepository.findById(((Number) claims.get("uid")).intValue()).orElse(null);
        // The fingerprint changes once the password changes, so a token works only once
        if (user == null || ((Number) claims.get("fp")).intValue() != fingerprint(user)) {
            throw new UserException(HttpStatus.UNAUTHORIZED, "This reset link is invalid or has expired.");
        }
        if (!meetsRules(req.newPassword())) {
            throw new UserException(HttpStatus.BAD_REQUEST,
                    "Password must be at least 8 characters, start with a letter, and include a letter, number, and special character.");
        }
        if (wasUsedBefore(user, req.newPassword())) {
            throw new UserException(HttpStatus.CONFLICT,
                    "This password has been used before. Please choose a different password.");
        }

        LocalDate today = LocalDate.now();
        historyRepository.save(new PasswordHistory(user, user.getPasswordHash(), today));
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        user.setTempPasswordExpiresAt(null);
        user.setPasswordChangedAt(today);
        user.setPasswordExpiry(today.plusDays(PASSWORD_LIFETIME_DAYS));
        user.setPasswordAttempts(0);
        userRepository.save(user);
    }

    private boolean wasUsedBefore(User user, String raw) {
        if (passwordEncoder.matches(raw, user.getPasswordHash())) return true;
        return historyRepository.findByUserId(user.getId()).stream()
                .anyMatch(h -> passwordEncoder.matches(raw, h.getPasswordHash()));
    }

    // Answers are stored as BCrypt hashes of the trimmed, lowercased answer
    private boolean answerMatches(String given, String storedHash) {
        return given != null && storedHash != null
                && passwordEncoder.matches(given.trim().toLowerCase(), storedHash);
    }

    private int fingerprint(User user) {
        return user.getPasswordHash() == null ? 0 : user.getPasswordHash().hashCode();
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}