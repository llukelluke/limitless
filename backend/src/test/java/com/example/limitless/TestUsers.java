package com.example.limitless;

import com.example.limitless.entity.User;
import java.time.LocalDate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Builders for users in unit tests. */
public final class TestUsers {

    // Low cost factor keeps BCrypt fast in tests
    public static final PasswordEncoder ENCODER = new BCryptPasswordEncoder(4);

    private TestUsers() {
    }

    public static User active(int id, String username, String rawPassword) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setFirstName("Jordan");
        user.setLastName("Lee");
        user.setEmailAddress(username + "@email.com");
        user.setRole(User.UserRole.ACCOUNTANT);
        user.setStatus(User.UserStatus.ACTIVATED);
        user.setPasswordHash(ENCODER.encode(rawPassword));
        user.setPasswordAttempts(0);
        user.setPasswordExpiry(LocalDate.now().plusDays(90));
        user.setCreatedAt(LocalDate.now());
        return user;
    }

    public static User withAnswers(User user, String a1, String a2, String a3) {
        user.setSecurityAnswer1(ENCODER.encode(a1));
        user.setSecurityAnswer2(ENCODER.encode(a2));
        user.setSecurityAnswer3(ENCODER.encode(a3));
        return user;
    }
}
