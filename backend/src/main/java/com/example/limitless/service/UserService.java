package com.example.limitless.service;

import com.example.limitless.dto.*;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.UserRepository;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private static final int PASSWORD_LIFETIME_DAYS = 90;
    private static final String PW_CHARS =
            "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final String PW_SPECIALS = "!@#$%";

    private final UserRepository userRepository;
    public static final java.time.Duration TEMP_PASSWORD_LIFETIME = java.time.Duration.ofHours(24);
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom random = new SecureRandom();

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // ---------- Reads ----------

    @Transactional(readOnly = true)
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @Transactional(readOnly = true)
    public User getUserById(Integer id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new UserException(HttpStatus.NOT_FOUND, "User doesn't exist."));
    }

    @Transactional(readOnly = true)
    public List<User> getUsersWithExpiredPasswords() {
        return userRepository.findByPasswordExpiryBefore(LocalDate.now());
    }

    // ---------- Create ----------

    @Transactional
    public CreateUserResponse createUser(CreateUserRequest req, String adminUsername) {
        if (isBlank(req.firstName()) || isBlank(req.lastName()) || isBlank(req.emailAddress())
                || req.role() == null) {
            throw new UserException(HttpStatus.BAD_REQUEST, "One or more fields are invalid.");
        }
        if (userRepository.findByEmailAddress(req.emailAddress()).isPresent()) {
            throw new UserException(HttpStatus.CONFLICT, "A user with this email address already exists.");
        }

        User user = new User();
        user.setFirstName(req.firstName().trim());
        user.setLastName(req.lastName().trim());
        user.setEmailAddress(req.emailAddress().trim());
        user.setHomeAddress(req.homeAddress());
        user.setBirthDate(req.birthDate());
        user.setRole(parseRole(req.role()));

        LocalDate today = LocalDate.now();
        user.setUsername(generateUsername(user.getFirstName(), user.getLastName(), today));
        user.setStatus(User.UserStatus.ACTIVATED);
        user.setCreatedAt(today);
        user.setPasswordAttempts(0);

        String tempPassword = generateTempPassword();
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setTempPasswordExpiresAt(java.time.LocalDateTime.now().plus(TEMP_PASSWORD_LIFETIME));
        user.setPasswordChangedAt(today);
        user.setPasswordExpiry(today.plusDays(PASSWORD_LIFETIME_DAYS));

        user.setSecurityQuestion1(req.securityQuestion1());
        user.setSecurityQuestion2(req.securityQuestion2());
        user.setSecurityQuestion3(req.securityQuestion3());
        user.setSecurityAnswer1(hashAnswer(req.securityAnswer1()));
        user.setSecurityAnswer2(hashAnswer(req.securityAnswer2()));
        user.setSecurityAnswer3(hashAnswer(req.securityAnswer3()));

        userRepository.findByUsername(adminUsername)
                .ifPresent(admin -> user.setCreatedBy(admin.getCreatedBy()));

        User saved = userRepository.save(user);
        return new CreateUserResponse(UserResponse.from(saved), tempPassword);
    }

    // ---------- Update ----------

    @Transactional
    public User updateUser(Integer id, UpdateUserRequest req) {
        User user = getUserById(id);

        if (req.emailAddress() != null && !req.emailAddress().equalsIgnoreCase(user.getEmailAddress())) {
            if (userRepository.findByEmailAddress(req.emailAddress()).isPresent()) {
                throw new UserException(HttpStatus.CONFLICT, "A user with this email address already exists.");
            }
            user.setEmailAddress(req.emailAddress().trim());
        }
        if (req.firstName() != null) user.setFirstName(req.firstName().trim());
        if (req.lastName() != null) user.setLastName(req.lastName().trim());
        if (req.homeAddress() != null) user.setHomeAddress(req.homeAddress());
        if (req.birthDate() != null) user.setBirthDate(req.birthDate());
        if (req.picture() != null) user.setPicture(req.picture());
        if (req.role() != null) user.setRole(parseRole(req.role()));

        // Username is NOT regenerated on name change; it is fixed at creation.
        return userRepository.save(user);
    }

    /** Replaces the user's password with a new temporary one (e.g. after the old one expired). */
    @Transactional
    public String issueTemporaryPassword(Integer id) {
        User user = getUserById(id);
        String tempPassword = generateTempPassword();
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setTempPasswordExpiresAt(java.time.LocalDateTime.now().plus(TEMP_PASSWORD_LIFETIME));
        user.setPasswordAttempts(0);
        userRepository.save(user);
        return tempPassword;
    }

    // ---------- Status changes ----------

    @Transactional
    public User activateUser(Integer id) {
        User user = getUserById(id);
        user.setStatus(User.UserStatus.ACTIVATED);
        user.setSuspensionStart(null);
        user.setSuspensionEnd(null);
        user.setPasswordAttempts(0);
        return userRepository.save(user);
    }

    @Transactional
    public User deactivateUser(Integer id) {
        User user = getUserById(id);
        user.setStatus(User.UserStatus.DEACTIVATED);
        return userRepository.save(user);
    }

    @Transactional
    public User suspendUser(Integer id, SuspendRequest req) {
        if (req.suspensionStart() == null || req.suspensionEnd() == null
                || !req.suspensionEnd().isAfter(req.suspensionStart())) {
            throw new UserException(HttpStatus.BAD_REQUEST,
                    "Suspension end date must be after the start date.");
        }
        User user = getUserById(id);
        user.setStatus(User.UserStatus.SUSPENDED);
        user.setSuspensionStart(req.suspensionStart());
        user.setSuspensionEnd(req.suspensionEnd());
        return userRepository.save(user);
    }

    // ---------- Helpers ----------

    // first initial + full last name + MMYY of creation, e.g. jlawson0926.
    // Appends 2, 3, ... if that username is already taken.
    public String generateUsername(String first, String last, LocalDate date) {
        String base = (first.substring(0, 1) + last).toLowerCase().replaceAll("[^a-z0-9]", "")
                + String.format("%02d%02d", date.getMonthValue(), date.getYear() % 100);
        String candidate = base;
        int n = 2;
        while (userRepository.findByUsername(candidate).isPresent()) {
            candidate = base + n++;
        }
        return candidate;
    }

    // Satisfies the rules: 8+ chars, starts with a letter, has a letter, number and special char.
    public String generateTempPassword() {
        StringBuilder sb = new StringBuilder();
        sb.append(PW_CHARS.charAt(random.nextInt(48))); // first 48 chars are letters only
        for (int i = 0; i < 8; i++) sb.append(PW_CHARS.charAt(random.nextInt(PW_CHARS.length())));
        sb.append("7");
        sb.append(PW_SPECIALS.charAt(random.nextInt(PW_SPECIALS.length())));
        return sb.toString();
    }

    // Answers are stored as BCrypt hashes of the trimmed, lowercased answer
    private String hashAnswer(String answer) {
        return isBlank(answer) ? null : passwordEncoder.encode(answer.trim().toLowerCase());
    }

    public User.UserRole parseRole(String role) {
        try {
            return User.UserRole.valueOf(role.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new UserException(HttpStatus.BAD_REQUEST, "One or more fields are invalid.");
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}