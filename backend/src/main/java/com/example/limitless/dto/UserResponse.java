package com.example.limitless.dto;

import com.example.limitless.entity.User;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;

// Deliberately has no password_hash or security answers.
public record UserResponse(
        Integer id,
        String username,
        @JsonProperty("first_name") String firstName,
        @JsonProperty("last_name") String lastName,
        @JsonProperty("email_address") String emailAddress,
        @JsonProperty("home_address") String homeAddress,
        @JsonProperty("birth_date") LocalDate birthDate,
        String picture,
        String role,
        String status,
        @JsonProperty("suspension_start") LocalDate suspensionStart,
        @JsonProperty("suspension_end") LocalDate suspensionEnd,
        @JsonProperty("password_expiry") LocalDate passwordExpiry,
        @JsonProperty("temp_password_expires_at") java.time.LocalDateTime tempPasswordExpiresAt,
        @JsonProperty("created_at") LocalDate createdAt) {

    public static UserResponse from(User u) {
        return new UserResponse(
                u.getId(), u.getUsername(), u.getFirstName(), u.getLastName(),
                u.getEmailAddress(), u.getHomeAddress(), u.getBirthDate(), u.getPicture(),
                u.getRole() == null ? null : u.getRole().name(),
                u.getStatus() == null ? null : u.getStatus().name(),
                u.getSuspensionStart(), u.getSuspensionEnd(),
                u.getPasswordExpiry(), u.getTempPasswordExpiresAt(), u.getCreatedAt());
    }
}