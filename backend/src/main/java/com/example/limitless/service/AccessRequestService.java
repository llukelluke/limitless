package com.example.limitless.service;

import com.example.limitless.dto.AccessRequestRequest;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.UserRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Sprint item 8: a first-time user requests access; an admin approves or rejects. */
@Service
public class AccessRequestService {

    private static final String NOT_FOUND = "Access request doesn't exist";

    private final UserRepository userRepository;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final String appUrl;

    public AccessRequestService(UserRepository userRepository, UserService userService,
                                PasswordEncoder passwordEncoder, EmailService emailService,
                                @Value("${app.url}") String appUrl) {
        this.userRepository = userRepository;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.appUrl = appUrl;
    }

    @Transactional
    public User createRequest(AccessRequestRequest req) {
        if (blank(req.firstName()) || blank(req.lastName()) || blank(req.emailAddress())) {
            throw new UserException(HttpStatus.BAD_REQUEST,
                    "First name, last name, and email address are required.");
        }
        if (userRepository.findByEmailAddress(req.emailAddress().trim()).isPresent()) {
            throw new UserException(HttpStatus.CONFLICT, "A user with this email address already exists.");
        }

        User user = new User();
        user.setFirstName(req.firstName().trim());
        user.setLastName(req.lastName().trim());
        user.setEmailAddress(req.emailAddress().trim());
        user.setHomeAddress(req.homeAddress());
        user.setBirthDate(req.birthDate());
        user.setStatus(User.UserStatus.PENDING);
        user.setCreatedAt(LocalDate.now());
        user.setPasswordAttempts(0);
        user.setSecurityQuestion1(req.securityQuestion1());
        user.setSecurityQuestion2(req.securityQuestion2());
        user.setSecurityQuestion3(req.securityQuestion3());
        user.setSecurityAnswer1(hash(req.securityAnswer1()));
        user.setSecurityAnswer2(hash(req.securityAnswer2()));
        user.setSecurityAnswer3(hash(req.securityAnswer3()));
        User saved = userRepository.save(user);

        List<User> admins = userRepository.findByRole(User.UserRole.ADMINISTRATOR);
        for (User admin : admins) {
            emailService.send(admin.getEmailAddress(), "New access request",
                    saved.getFirstName() + " " + saved.getLastName() + " (" + saved.getEmailAddress()
                            + ") requested access. Request id: " + saved.getId()
                            + ". Approve or reject it in the system.");
        }
        return saved;
    }

    /** Approves a pending request: assigns role, username and a temporary password, then emails the user. */
    @Transactional
    public User approve(Integer id, String role) {
        User user = findPending(id);
        LocalDate today = LocalDate.now();
        String tempPassword = userService.generateTempPassword();

        user.setRole(role == null || role.isBlank()
                ? User.UserRole.ACCOUNTANT : userService.parseRole(role));
        user.setUsername(userService.generateUsername(user.getFirstName(), user.getLastName(), today));
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setTempPasswordExpiresAt(java.time.LocalDateTime.now().plus(UserService.TEMP_PASSWORD_LIFETIME));
        user.setPasswordChangedAt(today);
        user.setPasswordExpiry(today.plusDays(90));
        user.setStatus(User.UserStatus.ACTIVATED);
        User saved = userRepository.save(user);

        emailService.send(saved.getEmailAddress(), "Your Limitless access request was approved",
                "Hi " + saved.getFirstName() + ",\n\nYour request was approved.\n"
                        + "Username: " + saved.getUsername() + "\n"
                        + "Temporary password: " + tempPassword + " (expires in 24 hours)\n\n"
                        + "Log in here: " + appUrl + "/login");
        return saved;
    }

    @Transactional
    public User reject(Integer id) {
        User user = findPending(id);
        user.setStatus(User.UserStatus.DEACTIVATED);
        User saved = userRepository.save(user);
        emailService.send(saved.getEmailAddress(), "Your Limitless access request",
                "Hi " + saved.getFirstName() + ",\n\nYour access request was not approved.");
        return saved;
    }

    private User findPending(Integer id) {
        return userRepository.findById(id)
                .filter(u -> u.getStatus() == User.UserStatus.PENDING)
                .orElseThrow(() -> new UserException(HttpStatus.NOT_FOUND, NOT_FOUND));
    }

    private String hash(String answer) {
        return blank(answer) ? null : passwordEncoder.encode(answer.trim().toLowerCase());
    }

    private boolean blank(String s) {
        return s == null || s.isBlank();
    }
}