package com.example.limitless.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at")
    private LocalDate createdAt;

    @Column(unique = true, length = 50, nullable = false)
    private String username;

    @Column(name = "password_hash", length = 64, nullable = false)
    private String passwordHash;

    @Column(name = "first_name", length = 100)
    private String firstName;

    @Column(name = "last_name", length = 100)
    private String lastName;

    @Column(name = "home_address", length = 255)
    private String homeAddress;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(unique = true, name = "email_address", length = 255, nullable = false)
    private String emailAddress;

    @Column(length = 255)
    private String picture;

    @Enumerated(EnumType.STRING)
    private UserStatus status;

    @Column(name = "suspension_start")
    private LocalDate suspensionStart;

    @Column(name = "suspension_end")
    private LocalDate suspensionEnd;

    @Column(name = "password_changed_at")
    private LocalDate passwordChangedAt;

    @Column(name = "password_expiry")
    private LocalDate passwordExpiry;

    // Set when a temporary password is issued; null once the user picks their own.
    @Column(name = "temp_password_expires_at")
    private java.time.LocalDateTime tempPasswordExpiresAt;

    @Column(name = "password_attempts")
    private Integer passwordAttempts;

    @Column(name = "security_question1", length = 255)
    private String securityQuestion1;
    @Column(name = "security_question2", length = 255)
    private String securityQuestion2;
    @Column(name = "security_question3", length = 255)
    private String securityQuestion3;

    @Column(name = "security_answer1", length =255)
    private String securityAnswer1;
    @Column(name = "security_answer2", length =255)
    private String securityAnswer2;
    @Column(name = "security_answer3", length =255)
    private String securityAnswer3;

    @Enumerated(EnumType.STRING)
    private UserRole role;

    public enum UserStatus {PENDING, ACTIVATED, DEACTIVATED, SUSPENDED}

    public enum UserRole {ACCOUNTANT, MANAGER, ADMINISTRATOR}
}
